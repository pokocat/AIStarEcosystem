package com.aistareco.aep.billing.service;

import com.aistareco.aep.billing.repository.CreditGrantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;

/** Expiry is also checked on every reservation. This sweep only finalizes unused balances in the ledger. */
@Component
public class ScopedCreditExpiry {
    private static final Logger log=LoggerFactory.getLogger(ScopedCreditExpiry.class);
    private final CreditGrantRepository grants;
    private final ScopedCreditService service;
    public ScopedCreditExpiry(CreditGrantRepository grants,ScopedCreditService service){this.grants=grants;this.service=service;}
    @Scheduled(fixedDelayString="${aep.scoped-credits.expiry-delay-ms:60000}",initialDelayString="${aep.scoped-credits.expiry-initial-delay-ms:60000}")
    public void expire() {
        Instant now=Instant.now();
        for(String wallet:grants.expiredWallets(now,PageRequest.of(0,200))) {
            try{service.expireWallet(wallet,now);}
            catch(RuntimeException e){log.warn("[scoped-credits] expiry failed wallet={}",wallet,e);}
        }
    }
}
