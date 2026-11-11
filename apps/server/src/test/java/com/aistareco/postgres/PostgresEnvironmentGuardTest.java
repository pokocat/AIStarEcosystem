package com.aistareco.postgres;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.context.annotation.Bean;
import org.springframework.mock.env.MockEnvironment;
import javax.sql.DataSource;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.assertj.core.api.Assertions.*;

class PostgresEnvironmentGuardTest {
    static final AtomicBoolean datasourceCreated=new AtomicBoolean();
    static class ProbeConfiguration {
        @Bean DataSource dataSource() { datasourceCreated.set(true);throw new AssertionError("Database must never initialize for rejected configuration"); }
    }
    @Test void inheritedUpdateIsRejectedBeforeAnyDatasourceBeanExists() {
        datasourceCreated.set(false);var app=new SpringApplication(ProbeConfiguration.class);app.setWebApplicationType(WebApplicationType.NONE);
        app.setDefaultProperties(Map.of("spring.config.location","optional:classpath:/missing-guard-test.yml", "spring.profiles.active","postgres",
            "spring.jpa.hibernate.ddl-auto","update","spring.flyway.enabled","true","spring.flyway.locations","classpath:db/postgresql",
            "spring.flyway.baseline-on-migrate","false","aep.cdn.driver","oss","aep.sms.driver","aliyun"));
        assertThatThrownBy(()->app.run()).isInstanceOf(IllegalStateException.class).hasMessageContaining("before database initialization").hasMessageContaining("ddl-auto");
        assertThat(datasourceCreated.get()).isFalse();
    }
    @Test void devProfileRetainsItsExistingSchemaMode() {
        var env=new MockEnvironment().withProperty("spring.jpa.hibernate.ddl-auto","update");env.setActiveProfiles("dev");
        assertThatCode(()->new PostgresEnvironmentGuard().postProcessEnvironment(env,null)).doesNotThrowAnyException();
    }
}
