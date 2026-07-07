package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.UserInventory;
import com.aistareco.aep.repository.UserInventoryRepository;
import com.aistareco.model.WardrobeItem;
import com.aistareco.repository.ExpressionRepository;
import com.aistareco.repository.GestureRepository;
import com.aistareco.repository.PoseRepository;
import com.aistareco.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * v0.99 例行 QA：{@link StoreService#redeem} 此前手写
 * {@code walletRepo.findByUserIdForUpdate → setXxxBalance → save}，绕开
 * {@link CreditService}（违反 AGENTS.md §4.2「所有钱包余额变动必须经 LedgerEntry /
 * CreditService」硬规则）。改为经 {@link CreditService#debit} 的 SPEND 重载后，
 * 锁定：① 真的调用了 CreditService.debit（而不是自己捣鼓 Wallet）；
 * ② entryType 是 SPEND、referenceType/referenceId/price 传对；
 * ③ CreditService 抛出的 402/其它业务异常会原样冒泡（redeem 不吞异常、不落库存）；
 * ④ 并发双击时 UserInventory 唯一约束冲突仍能拦下（该场景在同一物理事务内，
 *    CreditService.debit 的扣费与本方法共享事务边界，回归见 integration 测试，
 *    这里只验证 service 层异常转译）。
 */
class StoreServiceRedeemTest {

    private static final String USER = "u1";
    private static final String ITEM = "wardrobe-1";

    private WardrobeItemRepository wardrobeRepo;
    private UserInventoryRepository inventoryRepo;
    private CreditService creditService;
    private StoreService svc;

    @BeforeEach
    void setUp() {
        wardrobeRepo = mock(WardrobeItemRepository.class);
        PoseRepository poseRepo = mock(PoseRepository.class);
        ExpressionRepository expressionRepo = mock(ExpressionRepository.class);
        GestureRepository gestureRepo = mock(GestureRepository.class);
        inventoryRepo = mock(UserInventoryRepository.class);
        creditService = mock(CreditService.class);
        svc = new StoreService(wardrobeRepo, poseRepo, expressionRepo, gestureRepo, inventoryRepo, creditService);
    }

    private WardrobeItem paidItem(int price) {
        WardrobeItem w = WardrobeItem.builder()
                .id(ITEM)
                .saleStatus(WardrobeItem.SaleStatus.PAID)
                .priceCredits(price)
                .build();
        when(wardrobeRepo.findById(ITEM)).thenReturn(Optional.of(w));
        return w;
    }

    @Test
    void redeemDelegatesToCreditServiceDebit_notManualWalletMutation() {
        paidItem(120);
        when(inventoryRepo.existsByUserIdAndItemTypeAndItemId(USER, UserInventory.ItemType.WARDROBE, ITEM))
                .thenReturn(false);
        LedgerEntryDto entryDto = new LedgerEntryDto("ledger-1", "w1", USER, null, null, null,
                "spend", -120, 880, "购买 WARDROBE · " + ITEM, ITEM, "store_wardrobe", Instant.now());
        when(creditService.debit(eq(USER), eq(120L), eq(LedgerEntry.LedgerEntryType.SPEND),
                eq("store_wardrobe"), eq(ITEM), anyString())).thenReturn(entryDto);
        when(inventoryRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = svc.redeem(USER, UserInventory.ItemType.WARDROBE, ITEM);

        assertEquals("ledger-1", result.ledgerEntryId());
        verify(creditService).debit(eq(USER), eq(120L), eq(LedgerEntry.LedgerEntryType.SPEND),
                eq("store_wardrobe"), eq(ITEM), anyString());
        // 硬规则回归：redeem 不得自己拿 WalletRepository/LedgerEntryRepository 直接写余额 ——
        // StoreService 构造函数已不再接受这两个依赖，编译期即保证；这里再断言唯一的钱包动作
        // 入口是 creditService.debit。
    }

    @Test
    void insufficientBalancePropagatesFromCreditService_doesNotPersistInventory() {
        paidItem(500);
        when(inventoryRepo.existsByUserIdAndItemTypeAndItemId(USER, UserInventory.ItemType.WARDROBE, ITEM))
                .thenReturn(false);
        when(creditService.debit(eq(USER), eq(500L), eq(LedgerEntry.LedgerEntryType.SPEND),
                eq("store_wardrobe"), eq(ITEM), anyString()))
                .thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.PAYMENT_REQUIRED, "余额不足"));

        assertThrows(ResponseStatusException.class, () -> svc.redeem(USER, UserInventory.ItemType.WARDROBE, ITEM));
        verify(inventoryRepo, never()).save(any());
    }

    @Test
    void alreadyOwnedShortCircuitsBeforeCharging() {
        paidItem(120);
        when(inventoryRepo.existsByUserIdAndItemTypeAndItemId(USER, UserInventory.ItemType.WARDROBE, ITEM))
                .thenReturn(true);

        assertThrows(ResponseStatusException.class, () -> svc.redeem(USER, UserInventory.ItemType.WARDROBE, ITEM));
        verify(creditService, never()).debit(any(), anyLong(), any(), any(), any(), any());
    }

    @Test
    void concurrentDoubleInsertTranslatesToConflict() {
        paidItem(120);
        when(inventoryRepo.existsByUserIdAndItemTypeAndItemId(USER, UserInventory.ItemType.WARDROBE, ITEM))
                .thenReturn(false);
        LedgerEntryDto entryDto = new LedgerEntryDto("ledger-2", "w1", USER, null, null, null,
                "spend", -120, 880, "购买", ITEM, "store_wardrobe", Instant.now());
        when(creditService.debit(any(), anyLong(), any(), any(), any(), any())).thenReturn(entryDto);
        when(inventoryRepo.save(any())).thenThrow(new DataIntegrityViolationException("dup"));

        assertThrows(ResponseStatusException.class, () -> svc.redeem(USER, UserInventory.ItemType.WARDROBE, ITEM));
    }
}
