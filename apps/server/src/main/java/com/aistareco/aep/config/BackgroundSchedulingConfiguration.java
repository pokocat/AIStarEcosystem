package com.aistareco.aep.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Standby and migration inspection processes must not consume or settle existing work. */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@ConditionalOnProperty(prefix = "aep.background", name = "enabled", havingValue = "true", matchIfMissing = true)
public class BackgroundSchedulingConfiguration {}
