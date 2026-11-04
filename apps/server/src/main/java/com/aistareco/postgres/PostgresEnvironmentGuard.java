package com.aistareco.postgres;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import java.util.Arrays;

/** Reject dangerous inherited overrides before a DataSource or Hibernate schema tool can be constructed. */
public class PostgresEnvironmentGuard implements EnvironmentPostProcessor, Ordered {
    @Override public int getOrder() { return Ordered.LOWEST_PRECEDENCE; }
    @Override public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if(!Arrays.asList(environment.getActiveProfiles()).contains("postgres"))return;
        var problems=PostgresRuntimeGuard.inspect(environment);
        if(!problems.isEmpty())throw new IllegalStateException("PostgreSQL configuration rejected before database initialization: "+String.join("; ",problems));
    }
}
