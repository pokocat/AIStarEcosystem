package com.aistareco.aep.enterprise;
import com.aistareco.aep.enterprise.controller.EnterpriseController;
import com.aistareco.aep.enterprise.service.EnterpriseMemberBatchService;
import com.aistareco.aep.enterprise.service.EnterpriseService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
class EnterpriseFeatureGateTest {
    private final ApplicationContextRunner runner=new ApplicationContextRunner().withUserConfiguration(EnterpriseController.class)
            .withBean(EnterpriseService.class,()->mock(EnterpriseService.class))
            .withBean(EnterpriseMemberBatchService.class,()->mock(EnterpriseMemberBatchService.class));
    @Test void defaultsToNoEnterpriseController(){runner.run(c->assertThat(c).doesNotHaveBean(EnterpriseController.class));}
    @Test void explicitEnableRegistersController(){runner.withPropertyValues("aep.enterprise.enabled=true").run(c->assertThat(c).hasSingleBean(EnterpriseController.class));}
}
