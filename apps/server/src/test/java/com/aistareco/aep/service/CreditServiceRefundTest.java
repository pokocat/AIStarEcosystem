package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.CreditHoldRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.WalletRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * v2 §15.5 / D17 现金退款回收 {@code CreditService.refundCashReclaim}：
 * clamp 到未消费充值余额、写资金面 REFUND_CASH（负额）、花光则 409。补堵审计 #9 双头占。
 */
class CreditServiceRefundTest {

    private static final String USER = "u1";

    private WalletRepository walletRepo;
    private LedgerEntryRepository ledgerRepo;
    private CreditService svc;

    @BeforeEach
    void setUp() {
        walletRepo = mock(WalletRepository.class);
        ledgerRepo = mock(LedgerEntryRepository.class);
        CreditHoldRepository holdRepo = mock(CreditHoldRepository.class);
        AepUserRepository userRepo = mock(AepUserRepository.class);
        svc = new CreditService(walletRepo, ledgerRepo, holdRepo, userRepo);
        when(ledgerRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private Wallet wallet(long recharge, long gift) {
        Wallet w = Wallet.builder().id("w1").userId(USER)
                .rechargeBalance(recharge).giftBalance(gift)
                .totalBalance(recharge + gift).build();
        when(walletRepo.findByUserIdForUpdate(USER)).thenReturn(Optional.of(w));
        return w;
    }

    @Test
    void reclaimsExactlyWhenSufficientRecharge() {
        Wallet w = wallet(2000, 500);
        LedgerEntryDto e = svc.refundCashReclaim(USER, 1000, "ord-1", "退款");
        assertEquals(-1000, e.amount(), "充足时回收全额（负额）");
        assertEquals(1000, w.getRechargeBalance());
        assertEquals(500, w.getGiftBalance(), "gift 桶不受现金退款影响");
        assertEquals(1500, w.getTotalBalance());
        verify(ledgerRepo).save(argThat(le ->
                le.getEntryType() == LedgerEntry.LedgerEntryType.REFUND_CASH && le.getAmount() == -1000));
    }

    @Test
    void clampsReclaimToUnconsumedRecharge() {
        Wallet w = wallet(300, 0); // 已消费 700，只剩 300 未消费
        LedgerEntryDto e = svc.refundCashReclaim(USER, 1000, "ord-1", "退款");
        assertEquals(-300, e.amount(), "回收 clamp 到未消费的 300");
        assertEquals(0, w.getRechargeBalance());
        assertEquals(0, w.getTotalBalance());
    }

    @Test
    void fullyConsumedRejectsWithConflict() {
        wallet(0, 800); // 充值已花光（gift 不算未消费充值额）
        assertThrows(ResponseStatusException.class, () -> svc.refundCashReclaim(USER, 1000, "ord-1", "退款"));
        verify(ledgerRepo, never()).save(any());
    }

    @Test
    void rejectsNonPositiveRequest() {
        assertThrows(ResponseStatusException.class, () -> svc.refundCashReclaim(USER, 0, "ord-1", "退款"));
    }
}
