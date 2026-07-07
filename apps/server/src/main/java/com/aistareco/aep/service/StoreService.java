package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.StoreItemDto;
import com.aistareco.aep.dto.UserInventoryDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.UserInventory;
import com.aistareco.aep.repository.UserInventoryRepository;
import com.aistareco.model.Expression;
import com.aistareco.model.Gesture;
import com.aistareco.model.Pose;
import com.aistareco.model.WardrobeItem;
import com.aistareco.repository.ExpressionRepository;
import com.aistareco.repository.GestureRepository;
import com.aistareco.repository.PoseRepository;
import com.aistareco.repository.WardrobeItemRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 商店与库存服务。
 * - catalog：按 itemType 返回商品清单，并基于 userInventory 标注 {@code owned}
 * - redeem：@Transactional 经 {@link CreditService#debit} 按 gift→license→recharge 扣桶顺序扣费
 *   （悲观行锁 + 不可变账本，entryType=SPEND）→ INSERT UserInventory
 */
@Service
public class StoreService {

    private final WardrobeItemRepository wardrobeRepo;
    private final PoseRepository poseRepo;
    private final ExpressionRepository expressionRepo;
    private final GestureRepository gestureRepo;

    private final UserInventoryRepository inventoryRepo;
    private final CreditService creditService;

    public StoreService(WardrobeItemRepository wardrobeRepo,
                        PoseRepository poseRepo,
                        ExpressionRepository expressionRepo,
                        GestureRepository gestureRepo,
                        UserInventoryRepository inventoryRepo,
                        CreditService creditService) {
        this.wardrobeRepo = wardrobeRepo;
        this.poseRepo = poseRepo;
        this.expressionRepo = expressionRepo;
        this.gestureRepo = gestureRepo;
        this.inventoryRepo = inventoryRepo;
        this.creditService = creditService;
    }

    // ── Catalog ─────────────────────────────────────────────────────────────

    public List<StoreItemDto> catalog(String userId, UserInventory.ItemType type) {
        Set<String> owned = ownedIds(userId, type);
        return switch (type) {
            case WARDROBE -> wardrobeRepo.findAll().stream()
                    .map(w -> StoreItemDto.ofWardrobe(w, owned.contains(w.getId())))
                    .toList();
            case POSE -> poseRepo.findAll().stream()
                    .map(p -> StoreItemDto.ofPose(p, owned.contains(p.getId())))
                    .toList();
            case EXPRESSION -> expressionRepo.findAll().stream()
                    .map(e -> StoreItemDto.ofExpression(e, owned.contains(e.getId())))
                    .toList();
            case GESTURE -> gestureRepo.findAll().stream()
                    .map(g -> StoreItemDto.ofGesture(g, owned.contains(g.getId())))
                    .toList();
            case NFT, FORGE_BLUEPRINT -> List.of();
        };
    }

    public List<StoreItemDto> catalogAll(String userId) {
        List<StoreItemDto> all = new ArrayList<>();
        for (UserInventory.ItemType t : List.of(
                UserInventory.ItemType.WARDROBE,
                UserInventory.ItemType.POSE,
                UserInventory.ItemType.EXPRESSION,
                UserInventory.ItemType.GESTURE)) {
            all.addAll(catalog(userId, t));
        }
        return all;
    }

    private Set<String> ownedIds(String userId, UserInventory.ItemType type) {
        if (userId == null) return Collections.emptySet();
        Set<String> ids = new HashSet<>();
        for (UserInventory inv : inventoryRepo.findByUserIdAndItemTypeOrderByAcquiredAtDesc(userId, type)) {
            ids.add(inv.getItemId());
        }
        return ids;
    }

    // ── Inventory listing ───────────────────────────────────────────────────

    public List<UserInventoryDto> listInventory(String userId, UserInventory.ItemType type) {
        List<UserInventory> rows = type == null
                ? inventoryRepo.findByUserIdOrderByAcquiredAtDesc(userId)
                : inventoryRepo.findByUserIdAndItemTypeOrderByAcquiredAtDesc(userId, type);
        return rows.stream().map(UserInventoryDto::from).toList();
    }

    public boolean isOwned(String userId, UserInventory.ItemType type, String itemId) {
        return inventoryRepo.existsByUserIdAndItemTypeAndItemId(userId, type, itemId);
    }

    // ── Redeem ──────────────────────────────────────────────────────────────

    /**
     * 核心购买流程：
     * <ol>
     *   <li>读取商品，校验 saleStatus = PAID 且 priceCredits > 0</li>
     *   <li>查重：已拥有 → 409</li>
     *   <li>经 {@link CreditService#debit} 扣费（悲观行锁 + gift→license→recharge 优先级 +
     *       不可变账本 SPEND 分录）</li>
     *   <li>INSERT UserInventory（唯一约束兜底并发重复；与扣费共享同一事务，冲突则整体回滚）</li>
     * </ol>
     *
     * <p>v0.99 例行 QA：此前本方法手写 {@code walletRepo.findByUserIdForUpdate → setXxxBalance →
     * save}（虽已用悲观锁 + 服务端权威价，未被并发/定价漏洞利用），但直接绕开 CreditService，
     * 违反 AGENTS.md §4.2「所有钱包余额变动必须经 LedgerEntry / CreditService」硬规则，且复制了
     * 扣桶优先级逻辑，与唯一真源 CreditService 产生维护漂移风险。改为经 {@link CreditService#debit}
     * 的 SPEND 重载，行为等价（同一物理事务，唯一约束冲突仍整体回滚扣费）。
     */
    @Transactional
    public UserInventoryDto redeem(String userId, UserInventory.ItemType type, String itemId) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录用户不能购买");
        }
        int price = priceOf(type, itemId);

        if (inventoryRepo.existsByUserIdAndItemTypeAndItemId(userId, type, itemId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已拥有该商品");
        }

        LedgerEntryDto entry = creditService.debit(userId, price, LedgerEntry.LedgerEntryType.SPEND,
                "store_" + type.name().toLowerCase(), itemId, "购买 " + type.name() + " · " + itemId);

        UserInventory inv = UserInventory.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .itemType(type)
                .itemId(itemId)
                .source(UserInventory.AcquireSource.PURCHASE)
                .creditsSpent(price)
                .ledgerEntryId(entry.id())
                .acquiredAt(Instant.now())
                .build();
        try {
            inventoryRepo.save(inv);
        } catch (DataIntegrityViolationException ex) {
            // 并发双击：唯一约束兜底回滚整个事务（含上面 debit() 的扣费，因是同一物理事务）
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已拥有该商品");
        }
        return UserInventoryDto.from(inv);
    }

    /**
     * 运营端赠送（不扣积分，不写 ledger）。
     */
    @Transactional
    public UserInventoryDto grant(String userId, UserInventory.ItemType type, String itemId) {
        if (inventoryRepo.existsByUserIdAndItemTypeAndItemId(userId, type, itemId)) {
            return UserInventoryDto.from(
                    inventoryRepo.findByUserIdAndItemTypeAndItemId(userId, type, itemId).orElseThrow());
        }
        UserInventory inv = UserInventory.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .itemType(type)
                .itemId(itemId)
                .source(UserInventory.AcquireSource.GRANT)
                .creditsSpent(0)
                .acquiredAt(Instant.now())
                .build();
        inventoryRepo.save(inv);
        return UserInventoryDto.from(inv);
    }

    private int priceOf(UserInventory.ItemType type, String itemId) {
        return switch (type) {
            case WARDROBE -> {
                WardrobeItem w = wardrobeRepo.findById(itemId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
                yield assertPaid(w.getSaleStatus(), w.getPriceCredits());
            }
            case POSE -> {
                Pose p = poseRepo.findById(itemId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
                yield assertPaid(p.getSaleStatus(), p.getPriceCredits());
            }
            case EXPRESSION -> {
                Expression e = expressionRepo.findById(itemId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
                yield assertPaid(e.getSaleStatus(), e.getPriceCredits());
            }
            case GESTURE -> {
                Gesture g = gestureRepo.findById(itemId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
                yield assertPaid(g.getSaleStatus(), g.getPriceCredits());
            }
            case NFT, FORGE_BLUEPRINT ->
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该品类暂不支持积分购买");
        };
    }

    private int assertPaid(WardrobeItem.SaleStatus status, int price) {
        if (status == null || status == WardrobeItem.SaleStatus.FREE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "免费商品无需购买");
        }
        if (status == WardrobeItem.SaleStatus.LOCKED) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "商品当前未上架");
        }
        if (price <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "商品未设置价格");
        }
        return price;
    }
}
