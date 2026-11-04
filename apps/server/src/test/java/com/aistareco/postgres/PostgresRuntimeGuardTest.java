package com.aistareco.postgres;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.assertj.core.api.Assertions.assertThat;
class PostgresRuntimeGuardTest {
    private MockEnvironment production() {
        var e=new MockEnvironment();e.setActiveProfiles("postgres");
        return e.withProperty("spring.jpa.hibernate.ddl-auto","validate").withProperty("spring.flyway.enabled","true")
            .withProperty("spring.flyway.locations","classpath:db/postgresql").withProperty("spring.flyway.baseline-on-migrate","false")
            .withProperty("aep.sms.code.store","tair").withProperty("aep.sms.tair.url","rediss://test:synthetic@redis.example:6379/15").withProperty("aep.cdn.driver","oss").withProperty("aep.sms.driver","aliyun");
    }
    @Test void productionRequiresSchemaAndRealDrivers() {
        assertThat(PostgresRuntimeGuard.inspect(production())).isEmpty();
        for(var pair:java.util.Map.of("spring.jpa.hibernate.ddl-auto","update","spring.flyway.locations","classpath:db/migration",
                "spring.flyway.enabled","false","spring.flyway.baseline-on-migrate","true","aep.cdn.driver","local","aep.sms.driver","log","aep.sms.code.store","memory","aep.sms.tair.url","redis://localhost:6379").entrySet()) {
            var e=production().withProperty(pair.getKey(),pair.getValue());assertThat(PostgresRuntimeGuard.inspect(e)).anyMatch(p->p.contains(pair.getKey()));
        }
        var e=production();e.setActiveProfiles("postgres","dev");assertThat(PostgresRuntimeGuard.inspect(e)).isNotEmpty();
        assertThat(PostgresRuntimeGuard.inspect(production().withProperty("aep.dap.allow-placeholder","true"))).isNotEmpty();
    }
}
