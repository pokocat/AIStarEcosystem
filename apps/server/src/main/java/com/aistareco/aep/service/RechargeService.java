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

    /** 运营核准：确认线下已收款 → 经不可变账本入账（main + bonus），订单转 PAID。 */
    @Transactional
    public RechargeOrderDto approveOrder(String orderId, String reviewerId, String reviewNote) {
        RechargeOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在"));
        if (order.getStatus() != RechargeOrder.Status.PENDING) {
            throw new BusinessException(HttpStatus.CONFLICT, "ORDER_NOT_PENDING",
                    "该订单状态为 " + order.getStatus() + "，无法核准");
        }

        // 1) 主分录：充值进 recharge 桶
        LedgerEntryDto mainEntry = creditService.creditAccount(
                order.getUserId(),
                order.getCredits(),
                LedgerEntry.LedgerEntryType.RECHARGE,
                "recharge_order",
                order.getId(),
                "充值订单核准 " + nz(order.getPackageTag()) + "（" + order.getCredits() + " 积分）"
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

        order.setStatus(RechargeOrder.Status.PAID);
        order.setReviewerId(reviewerId);
        order.setReviewNote(trimToNull(reviewNote, 512));
        order.setLedgerEntryId(mainEntry.id());
        order.setReviewedAt(Instant.now());
        order.setUpdatedAt(Instant.now());
        orderRepo.save(order);
        log.info("[recharge] order approved id={} userId={} reviewer={} credits={} bonus={}",
                order.getId(), order.getUserId(), reviewerId, order.getCredits(), order.getBonusCredits());
        notificationPublisher.notifyUser(order.getUserId(), Notification.NotificationType.REVENUE,
                "充值已到账",
                "充值订单 " + order.getId() + " 已核准：" + order.getCredits() + " 积分已入账"
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
