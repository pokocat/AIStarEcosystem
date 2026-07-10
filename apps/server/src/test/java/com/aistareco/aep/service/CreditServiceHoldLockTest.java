package com.aistareco.aep.service;

import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.CreditHoldRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.WalletRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 回归测试：commitHold / releaseHold 必须走 CreditHoldRepository 的悲观行锁版查询
 * （findByReferenceTypeAndReferenceIdForUpdate），不能再退回无锁版
 * （findByReferenceTypeAndReferenceId）—— 否则同一 hold 的并发 commit + release
 * （例如 CreditHoldSweeper 清扫超 TTL 孤儿 hold 与业务方几乎同时 commit 撞车）
 * 会各自读到同一份 status=ACTIVE 的旧对象，其中一次基于陈旧状态重复操作，
 * 造成双重退款 / hold 终态被覆盖。见 TODO.md 例行 QA 记录。
 */
class CreditServiceHoldLockTest {

    private static final String USER = "u1";
    private static final String REF_TYPE = "mixcut_job";
    private static final String REF_ID = "job-1";

    private CreditHoldRepository holdRepo;
    private WalletRepository walletRepo;
    private LedgerEntryRepository ledgerRepo;
    private CreditService svc;

    @BeforeEach
    void setUp() {
        walletRepo = mock(WalletRepository.class);
        ledgerRepo = mock(LedgerEntryRepository.class);
        holdRepo = mock(CreditHoldRepository.class);
        AepUserRepository userRepo = mock(AepUserRepository.class);
        svc = new CreditService(walletRepo, ledgerRepo, holdRepo, userRepo);
        when(ledgerRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private CreditHold activeHold(long amount) {
        return CreditHold.builder().id("h1").walletId("w1").userId(USER)
                .referenceType(REF_TYPE).referenceId(REF_ID)
                .amount(amount).remainingAmount(amount)
                .fromGift(0).fromLicense(0).fromRecharge(amount)
                .status(CreditHold.Status.ACTIVE)
                .createdAt(Instant.EPOCH).updatedAt(Instant.EPOCH).build();
    }

    private Wallet wallet(long pending, long recharge) {
        Wallet w = Wallet.builder().id("w1").userId(USER)
                .pendingBalance(pending).rechargeBalance(recharge)
                .totalBalance(recharge).build();
        when(walletRepo.findByUserIdForUpdate(USER)).thenReturn(Optional.of(w));
        return w;
    }

    @Test
    void commitHoldUsesLockedFinderNotPlainFinder() {
        wallet(100, 500);
        when(holdRepo.findByReferenceTypeAndReferenceIdForUpdate(REF_TYPE, REF_ID))
                .thenReturn(Optional.of(activeHold(100)));

        svc.commitHold(REF_TYPE, REF_ID, 100, "commit");

        verify(holdRepo).findByReferenceTypeAndReferenceIdForUpdate(REF_TYPE, REF_ID);
        verify(holdRepo, never()).findByReferenceTypeAndReferenceId(anyString(), anyString());
    }

    @Test
    void releaseHoldUsesLockedFinderNotPlainFinder() {
        wallet(100, 500);
        when(holdRepo.findByReferenceTypeAndReferenceIdForUpdate(REF_TYPE, REF_ID))
                .thenReturn(Optional.of(activeHold(100)));

        svc.releaseHold(REF_TYPE, REF_ID, "release");

        verify(holdRepo).findByReferenceTypeAndReferenceIdForUpdate(REF_TYPE, REF_ID);
        verify(holdRepo, never()).findByReferenceTypeAndReferenceId(anyString(), anyString());
    }

    @Test
    void releaseHoldNoOpWhenAlreadyCommittedByConcurrentCommit() {
        // 模拟锁串行化后重读：release 事务在 commit 事务提交后才拿到锁，此时 hold 已是 COMMITTED。
        CreditHold committed = activeHold(100);
        committed.setStatus(CreditHold.Status.COMMITTED);
        committed.setRemainingAmount(0);
        when(holdRepo.findByReferenceTypeAndReferenceIdForUpdate(REF_TYPE, REF_ID))
                .thenReturn(Optional.of(committed));

        var result = svc.releaseHold(REF_TYPE, REF_ID, "release");

        org.junit.jupiter.api.Assertions.assertNull(result, "已 COMMITTED 的 hold 不应再被 release 覆盖终态");
        verify(walletRepo, never()).findByUserIdForUpdate(anyString());
        verify(ledgerRepo, never()).save(any());
    }
}
