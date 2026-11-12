package com.aistareco.postgres;

import com.aistareco.aep.config.BackgroundSchedulingConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.scheduling.annotation.Scheduled;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.*;

class BackgroundSchedulingTest {
    static class Probe {
        final CountDownLatch called = new CountDownLatch(1);
        @Scheduled(fixedDelay=20) public void tick() { called.countDown(); }
    }
    @Test void standbyRegistersNoScheduledWork() throws Exception { check(false); }
    @Test void explicitPrimaryRunsScheduledWork() throws Exception { check(true); }
    private void check(boolean enabled) throws Exception {
        try(var context=new AnnotationConfigApplicationContext()) {
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test",Map.of("aep.background.enabled",enabled)));
            context.register(BackgroundSchedulingConfiguration.class,Probe.class);context.refresh();
            boolean ran=context.getBean(Probe.class).called.await(enabled?3:1,TimeUnit.SECONDS);
            assertThat(ran).isEqualTo(enabled);
        }
    }
}
