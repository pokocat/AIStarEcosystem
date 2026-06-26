package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.dto.RechargePackageDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.Notification;
import com.aistareco.aep.model.RechargeOrder;
import com.aistareco.aep.model.RechargePackage;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.RechargeOrderRepository;
import com.aistareco.aep.repository.RechargePackageRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 充值服务（v0.56 起改为「下单 → 运营核准入账」流程）。
 *
 * 旧 MVP（点击套餐直接入账）已废止 —— 那是「未付款即发积分」的生产事故级漏洞。
 * 现流程：
 *   1) 用户 {@link #createOrder} 下单 → 生成 PENDING 账单（不入账）。
 *   2) 平台运营线下收款后在 admin {@link #approveOrder} → 才经 {@link CreditService}
 *      走不可变账本入账（主分录 RECHARGE + 可选 GIFT），订单转 PAID。
 *   3) 收款不符 → {@link #rejectOrder}（REJECTED）；用户可 {@link #cancelOrder} 自己的待确认单。
 *
 * 入账逻辑（main + bonus 双分录）严格沿用既有 CreditService，不绕过账本（CLAUDE.md §4.2）。
 */
@Service
public class RechargeService {

    private static final Logger log = LoggerFactory.getLogger(RechargeService.class);

    /** 单用户待确认订单上限，防刷单。 */
    private static final long MAX_PENDING_PER_USER = 10;

    private final RechargePackageRepository pkgRepo;
    private final RechargeOrderRepository orderRepo;
    private final AepUserRepository userRepo;
    private final StudioRepository studioRepo;
    private final CreditService creditService;
    private final NotificationPublisher notificationPublisher;

    public RechargeService(RechargePackageRepository pkgRepo,
                           RechargeOrderRepository orderRepo,
                           AepUserRepository userRepo,
                           StudioRepository studioRepo,
                           CreditService creditService,
                           NotificationPublisher notificationPublisher) {
        this.pkgRepo = pkgRepo;
        this.orderRepo = orderRepo;
        this.userRepo = userRepo;
        this.studioRepo = studioRepo;
        this.creditService = creditService;
        this.notificationPublisher = notificationPublisher;
    }

    public List<RechargePackageDto> listPackages() {
        return pkgRepo.findByActiveTrueOrderBySortOrderAscCreditsAsc()
                .stream()
                .map(RechargePackageDto::from)
                .toList();
    }

    // ── 用户侧 ───────────────────────────────────────────────────────────────

    /** 下单：生成一张待确认充值账单（不入账）。 */
    @Transactional
    public RechargeOrderDto createOrder(String userId, String packageId, String userNote) {
        if (packageId == null || packageId.isBlank()) {
            throw BusinessException.badRequest("PACKAGE_ID_REQUIRED", "请选择充值套餐");
        }
        RechargePackage pkg = pkgRepo.findById(packageId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PACKAGE_NOT_FOUND", "套餐不存在：" + packageId));
        if (!pkg.isActive()) {
            throw new BusinessException(HttpStatus.GONE, "PACKAGE_INACTIVE", "套餐已下架：" + packageId);
        }
        if (orderRepo.countByUserIdAndStatus(userId, RechargeOrder.Status.PENDING) >= MAX_PENDING_PER_USER) {
            throw new BusinessException(HttpStatus.CONFLICT, "TOO_MANY_PENDING_ORDERS",
                    "你有较多待确认的充值订单，请先完成付款或取消后再下单");
        }

        AepUser user = userRepo.findById(userId).orElse(null);
        Studio studio = studioRepo.findByOwnerUserId(userId).orElse(null);

        Instant now = Instant.now();
        RechargeOrder order = RechargeOrder.builder()
                .id("ro-" + UUID.randomUUID().toString().substring(0, 12))
                .userId(userId)
                .username(user != null ? user.getUsername() : null)
                .displayName(user != null ? user.getDisplayName() : null)
                .studioName(studio != null ? studio.getName() : null)
                .packageId(pkg.getId())
                .packageTag(pkg.getTag())
                .credits(pkg.getCredits())
                .bonusCredits(pkg.getBonusCredits())
                .priceCents(pkg.getPriceCents())
                .status(RechargeOrder.Status.PENDING)
                .userNote(trimToNull(userNote, 512))
                .createdAt(now)
                .updatedAt(now)
                .build();
        orderRepo.save(order);
        log.info("[recharge] order created id={} userId={} pkg={} credits={} priceCents={}",
                order.getId(), userId, pkg.getId(), pkg.getCredits(), pkg.getPriceCents());
        notificationPublisher.notifyAdmins(Notification.NotificationType.REVENUE,
                "新充值订单待核准",
                "用户 " + accountLabel(user) + " 提交充值订单 " + order.getId() + "："
                        + nz(pkg.getTag()) + " " + pkg.getCredits() + " 积分"
                        + (pkg.getBonusCredits() > 0 ? "（另赠 " + pkg.getBonusCredits() + "）" : "")
                        + " / " + formatPrice(pkg.getPriceCents())
                        + "。请确认线下收款后在「财务 · 充值订单」核准入账。",
                userId);
        return RechargeOrderDto.from(order);
    }

    /**
     * 在线支付 checkout 专用：建一张 PENDING 充值订单（带 wayCode / sourceApp），
     * 不发「待运营核准」站内信（在线支付由回调 / 影子确认自动入账，无需人工核准）。
     * 校验同 {@link #createOrder}（套餐有效 + 待确认上限）。返回实体供 PaymentService 回填 payOrderId。
     */
    @Transactional
    public RechargeOrder createPendingForCheckout(String userId, String packageId, String wayCode, String sourceApp) {
        if (packageId == null || packageId.isBlank()) {
            throw BusinessException.badRequest("PACKAGE_ID_REQUIRED", "请选择充值套餐");
        }
        RechargePackage pkg = pkgRepo.findById(packageId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PACKAGE_NOT_FOUND", "套餐不存在：" + packageId));
        if (!pkg.isActive()) {
            throw new BusinessException(HttpStatus.GONE, "PACKAGE_INACTIVE", "套餐已下架：" + packageId);
        }
        if (orderRepo.countByUserIdAndStatus(userId, RechargeOrder.Status.PENDING) >= MAX_PENDING_PER_USER) {
            throw new BusinessException(HttpStatus.CONFLICT, "TOO_MANY_PENDING_ORDERS",
                    "你有较多待确认的充值订单，请先完成付款或取消后再下单");
        }
        AepUser user = userRepo.findById(userId).orElse(null);
        Studio studio = studioRepo.findByOwnerUserId(userId).orElse(null);
        Instant now = Instant.now();
        RechargeOrder order = RechargeOrder.builder()
                .id("ro-" + UUID.randomUUID().toString().substring(0, 12))
                .userId(userId)
                .username(user != null ? user.getUsername() : null)
                .displayName(user != null ? user.getDisplayName() : null)
                .studioName(studio != null ? studio.getName() : null)
                .packageId(pkg.getId())
                .packageTag(pkg.getTag())
                .credits(pkg.getCredits())
                .bonusCredits(pkg.getBonusCredits())
                .priceCents(pkg.getPriceCents())
                .status(RechargeOrder.Status.PENDING)
                .wayCode(wayCode)
                .sourceApp(sourceApp)
                .createdAt(now)
                .updatedAt(now)
                .build();
        orderRepo.save(order);
        log.info("[recharge] checkout order created id={} userId={} pkg={} wayCode={} sourceApp={} priceCents={}",
                order.getId(), userId, pkg.getId(), wayCode, sourceApp, pkg.getPriceCents());
        return order;
    }

    /** checkout 网关下单成功后回填 payOrderId（幂等 + 对账锚点）。 */
    @Transactional
    public void attachPayOrder(String orderId, String payOrderId) {
        RechargeOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));
        order.setPayOrderId(payOrderId);
        order.setUpdatedAt(Instant.now());
        orderRepo.save(order);
    }

    /** 网关下单失败 / 影子模拟失败：把 PENDING 订单标 CANCELLED（不留悬挂单）。 */
    @Transactional
    public RechargeOrderDto cancelForGatewayError(String orderId, String reason) {
        RechargeOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));
        if (order.getStatus() == RechargeOrder.Status.PENDING) {
            order.setStatus(RechargeOrder.Status.CANCELLED);
            order.setReviewNote(trimToNull(reason, 512));
            order.setUpdatedAt(Instant.now());
            orderRepo.save(order);
        }
        return RechargeOrderDto.from(order);
    }

    /** 单个订单查询（影子 timeout 等场景返回当前态）。 */
    public RechargeOrderDto getOrder(String orderId) {
        return orderRepo.findById(orderId)
                .map(RechargeOrderDto::from)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));
    }

    public List<RechargeOrderDto> listMyOrders(String userId) {
        return orderRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(RechargeOrderDto::from)
                .toList();
    }

    /** 用户取消自己的待确认订单。 */
    @Transactional
    public RechargeOrderDto cancelOrder(String userId, String orderId) {
        RechargeOrder order = orderRepo.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));
        if (order.getStatus() != RechargeOrder.Status.PENDING) {
            throw new BusinessException(HttpStatus.CONFLICT, "ORDER_NOT_PENDING", "该订单不是待确认状态，无法取消");
        }
        order.setStatus(RechargeOrder.Status.CANCELLED);
        order.setUpdatedAt(Instant.now());
        orderRepo.save(order);
        notificationPublisher.notifyAdmins(Notification.NotificationType.REVENUE,
                "充值订单已取消",
                "用户 " + accountLabelById(userId) + " 取消了待确认充值订单 " + order.getId()
                        + "（" + nz(order.getPackageTag()) + " " + order.getCredits() + " 积分 / "
                        + formatPrice(order.getPriceCents()) + "），无需再核准。",
                userId);
        return RechargeOrderDto.from(order);
    }

    // ── 运营侧（admin） ─────────────────────────────────────────────────────

    public List<RechargeOrderDto> listForAdmin(String status) {
        List<RechargeOrder> rows;
        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            RechargeOrder.Status s;
            try {
                s = RechargeOrder.Status.valueOf(status.trim().toUpperCase(java.util.Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                throw BusinessException.badRequest("INVALID_STATUS", "非法订单状态：" + status);
            }
            rows = orderRepo.findByStatusOrderByCreatedAtDesc(s);
        } else {
            rows = orderRepo.findAllByOrderByCreatedAtDesc();
        }
        return rows.stream().map(RechargeOrderDto::from).toList();
    }

    /** 运营核准：确认线下已收款 → 经共享入账核心 {@link #settlePaidOrder} 入账，订单转 PAID。 */
    @Transactional
    public RechargeOrderDto approveOrder(String orderId, String reviewerId, String reviewNote) {
        RechargeOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));
        if (order.getStatus() != RechargeOrder.Status.PENDING) {
            throw new BusinessException(HttpStatus.CONFLICT, "ORDER_NOT_PENDING",
                    "该订单状态为 " + order.getStatus() + "，无法核准");
        }
        return settlePaidOrder(orderId, "manual", null, reviewerId, trimToNull(reviewNote, 512));
    }

    /**
     * 入账核心（v2 §4.3）：手工核准 {@link #approveOrder}、在线支付回调（Jeepay notify）与影子确认
     * 共用这一条入账逻辑。
     *
     * 幂等：先用条件 UPDATE 抢占 PENDING → PAID（{@link RechargeOrderRepository#markPaid}）；
     * 抢不到（已结算 / 非 PENDING）→ 返回当前订单，绝不重复入账。抢到则在同一事务内：
     *   主分录 RECHARGE + 可选赠送 GIFT（经 {@link CreditService}，走钱包悲观锁 + 不可变账本），
     *   回填 ledgerEntryId / paidVia / channelPayNo / 审批信息，并通知用户。
     * 任一步抛异常 → 整个事务回滚（含 markPaid）→ 订单退回 PENDING，可重试。
     *
     * @param paidVia      入账来源：manual / jeepay / shadow
     * @param channelPayNo 渠道订单号（对账，可空）
     * @param reviewerId   手工核准人（在线回调 / 影子为 null）
     * @param reviewNote   核准备注（在线回调 / 影子为 null）
     */
    @Transactional
    public RechargeOrderDto settlePaidOrder(String orderId, String paidVia, String channelPayNo,
                                            String reviewerId, String reviewNote) {
        Instant now = Instant.now();
        int claimed = orderRepo.markPaid(orderId, now);
        if (claimed == 0) {
            // 已被结算（重复回调 / 并发）或订单不存在 → 幂等 no-op
            RechargeOrder existing = orderRepo.findById(orderId)
                    .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));
            log.info("[recharge] settle idempotent no-op id={} status={} paidVia={}",
                    orderId, existing.getStatus(), paidVia);
            return RechargeOrderDto.from(existing);
        }

        // 抢到结算权：重新载入（markPaid clearAutomatically 已清持久化上下文）
        RechargeOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));

        // 1) 主分录：充值进 recharge 桶
        LedgerEntryDto mainEntry = creditService.creditAccount(
                order.getUserId(),
                order.getCredits(),
                LedgerEntry.LedgerEntryType.RECHARGE,
                "recharge_order",
                order.getId(),
                "充值订单入账 " + nz(order.getPackageTag()) + "（" + order.getCredits() + " 积分）"
        );

        // 2) 赠送（可选）：进 gift 桶
        if (order.getBonusCredits() > 0) {
            creditService.creditAccount(
                    order.getUserId(),
                    order.getBonusCredits(),
                    LedgerEntry.LedgerEntryType.GIFT,
                    "recharge_order_bonus",
                    order.getId(),
                    "充值赠送 " + order.getBonusCredits() + " 积分（订单 " + order.getId() + "）"
            );
        }

        order.setLedgerEntryId(mainEntry.id());
        order.setPaidVia(paidVia);
        order.setChannelPayNo(channelPayNo);
        if (reviewerId != null) {
            order.setReviewerId(reviewerId);
            order.setReviewNote(reviewNote);
            order.setReviewedAt(now);
        }
        order.setUpdatedAt(now);
        orderRepo.save(order);
        log.info("[recharge] order settled id={} userId={} paidVia={} credits={} bonus={}",
                order.getId(), order.getUserId(), paidVia, order.getCredits(), order.getBonusCredits());
        notificationPublisher.notifyUser(order.getUserId(), Notification.NotificationType.REVENUE,
                "充值已到账",
                "充值订单 " + order.getId() + " 已入账：" + order.getCredits() + " 积分"
                        + (order.getBonusCredits() > 0 ? "，另赠送 " + order.getBonusCredits() + " 积分" : "")
                        + "。");
        return RechargeOrderDto.from(order);
    }

    /** 运营驳回：收款不符 / 无效订单。 */
    @Transactional
    public RechargeOrderDto rejectOrder(String orderId, String reviewerId, String reason) {
        RechargeOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));
        if (order.getStatus() != RechargeOrder.Status.PENDING) {
            throw new BusinessException(HttpStatus.CONFLICT, "ORDER_NOT_PENDING",
                    "该订单状态为 " + order.getStatus() + "，无法驳回");
        }
        order.setStatus(RechargeOrder.Status.REJECTED);
        order.setReviewerId(reviewerId);
        order.setReviewNote(trimToNull(reason, 512));
        order.setReviewedAt(Instant.now());
        order.setUpdatedAt(Instant.now());
        orderRepo.save(order);
        log.info("[recharge] order rejected id={} userId={} reviewer={}", order.getId(), order.getUserId(), reviewerId);
        notificationPublisher.notifyUser(order.getUserId(), Notification.NotificationType.REVENUE,
                "充值订单被驳回",
                "充值订单 " + order.getId() + "（" + nz(order.getPackageTag()) + " " + order.getCredits()
                        + " 积分）未通过核准。原因：" + nz(order.getReviewNote()) + "。如有疑问请联系平台运营。");
        return RechargeOrderDto.from(order);
    }

    /** 「昵称（登录名 xxx）」展示标签；admin 消息中心溯源用。 */
    private static String accountLabel(AepUser user) {
        if (user == null) return "（未知账号）";
        String display = user.getDisplayName() != null && !user.getDisplayName().isBlank()
                ? user.getDisplayName() : user.getUsername();
        return display + "（登录名 " + user.getUsername() + "）";
    }

    private String accountLabelById(String userId) {
        return accountLabel(userRepo.findById(userId).orElse(null));
    }

    private static String formatPrice(long priceCents) {
        return "¥" + (priceCents / 100) + (priceCents % 100 == 0 ? "" : String.format(".%02d", priceCents % 100));
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String trimToNull(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return t.length() > max ? t.substring(0, max) : t;
    }
}
