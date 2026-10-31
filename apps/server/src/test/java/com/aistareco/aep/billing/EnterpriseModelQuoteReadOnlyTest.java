package com.aistareco.aep.billing;

import com.aistareco.aep.billing.service.*;
import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.model.EnterpriseBillingAuthorization;
import com.aistareco.aep.enterprise.model.EnterprisePolicy;
import com.aistareco.aep.enterprise.repository.EnterpriseBillingAuthorizationRepository;
import com.aistareco.aep.enterprise.repository.EnterprisePolicyRepository;
import com.aistareco.aep.enterprise.service.EnterpriseBillingService;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.WalletRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.*;
import org.springframework.transaction.annotation.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Enterprise quotes run in a read-only transaction. MySQL rejects SELECT ... FOR UPDATE there (ERROR 1792),
 * so the active-job count must use a plain read. Run against MySQL with -Dmodel-scoped.jdbc=jdbc:mysql://...
 */
@DataJpaTest(showSql=false,properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop","aep.enterprise.enabled=true",
        "spring.datasource.url=jdbc:h2:mem:enterprise-quote;MODE=MySQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=CAST"})
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@Import({EnterpriseBillingService.class,ScopedCreditService.class,ModelPricingService.class,ModelChargeService.class,
        com.aistareco.aep.service.CreditService.class,EnterpriseModelQuoteReadOnlyTest.Config.class})
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class EnterpriseModelQuoteReadOnlyTest {
    @org.springframework.test.context.DynamicPropertySource
    static void database(org.springframework.test.context.DynamicPropertyRegistry properties) {
        String url=System.getProperty("model-scoped.jdbc","jdbc:h2:mem:enterprise-quote;MODE=MySQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=CAST");
        properties.add("spring.datasource.url",()->url);
        properties.add("spring.datasource.driver-class-name",()->url.startsWith("jdbc:mysql:")?"com.mysql.cj.jdbc.Driver":"org.h2.Driver");
        properties.add("spring.datasource.username",()->url.startsWith("jdbc:mysql:")?"root":"sa");
        properties.add("spring.datasource.password",()->"");
    }
    @TestConfiguration static class Config {@Bean ObjectMapper mapper(){return new ObjectMapper().findAndRegisterModules();}}

    @Autowired EnterpriseBillingService billing;
    @Autowired EnterprisePolicyRepository policies;
    @Autowired EnterpriseBillingAuthorizationRepository authorizations;
    @Autowired WalletRepository wallets;
    @MockBean com.aistareco.aep.enterprise.service.EnterpriseAccessService access;
    @MockBean com.aistareco.aep.enterprise.service.EnterpriseCreditLotService lots;
    @MockBean com.aistareco.aep.enterprise.service.EnterpriseFundRecoveryService recovery;

    private final ModelBillingTarget target=new ModelBillingTarget("aiavatar","image","endpoint-a","model-a","standard","image");
    private final BillingSelection enterprise=new BillingSelection("enterprise","company");

    @BeforeEach void setup() {
        authorizations.deleteAll();policies.deleteAll();wallets.deleteAll();
        var policy=new EnterprisePolicy();policy.setEnterpriseId("company");policy.setAllowedEndpointIdsJson("[\"endpoint-a\"]");policy.setMaxActiveJobs(2);
        policies.saveAndFlush(policy);
        wallets.saveAndFlush(Wallet.builder().id("member").accountType("enterprise_member").enterpriseId("company").memberUserId("one")
                .totalBalance(100).rechargeBalance(100).build());
        authorization("one","job-1",null);           // counts: the member's own active job
        authorization("one","job-1#1",null);         // a dialogue extension belongs to job-1, never a new job
        authorization("one","job-0",Instant.now());  // finished
        authorization("two","job-2",null);           // another member's job
    }

    @Test void enterpriseQuoteRunsReadOnlyAndKeepsTheActiveJobRule() {
        var quote=billing.quote("one",enterprise,charge());
        assertTrue(quote.canAfford());assertEquals(10,quote.walletCredits());
        assertEquals(1,billing.quoteRepeated("one",enterprise,charge(),1).approval().usage().quantity().intValue());
        var limited=assertThrows(BusinessException.class,()->billing.quoteRepeated("one",enterprise,charge(),2));
        assertEquals("ENTERPRISE_ACTIVE_JOB_LIMIT",limited.getCode());
        assertEquals(4,authorizations.count());
    }

    private ModelChargeContext charge() {
        return new ModelChargeContext(target,new ModelBillingMath.Usage(BigDecimal.ONE,null),BigDecimal.TEN,null,"v1",false,null,null);
    }
    private void authorization(String actor,String reference,Instant terminalAt) {
        var a=new EnterpriseBillingAuthorization();a.setId(UUID.randomUUID().toString());a.setEnterpriseId("company");a.setActorUserId(actor);
        a.setMembershipId("m-"+actor);a.setWalletId("member");a.setReferenceType("ip-run");a.setReferenceId(reference);a.setEndpointId("endpoint-a");
        a.setAmount(10);a.setStatus(terminalAt==null?"reserved":"committed");a.setCreatedAt(Instant.now());a.setUpdatedAt(Instant.now());a.setTerminalAt(terminalAt);
        authorizations.saveAndFlush(a);
    }
}
