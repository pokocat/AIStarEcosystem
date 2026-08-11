package com.aistareco.aep.clip.service.shiliu;

import com.aistareco.aep.clip.config.ClipProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class ShiliuServiceRoutingTest {
    @Test
    void configuredHttpGatewayWinsOverAllowMockFallback() {
        ClipProperties props = new ClipProperties();
        props.setAllowMock(true);
        props.setShiliuBaseUrl("https://api.16ai.chat/api/v1/");
        props.setShiliuToken("test-token");
        HttpShiliuGateway http = mock(HttpShiliuGateway.class);
        ShiliuService service = new ShiliuService(props, new MockEnvironment().withProperty("spring.profiles.active", "clip-preprod"), http);

        assertSame(http, service.required());
    }

    @Test
    void explicitForceMockOverridesConfiguredHttpOnlyOutsideProduction() {
        ClipProperties props = new ClipProperties();
        props.setForceMock(true);
        props.setShiliuBaseUrl("https://api.16ai.chat/api/v1/");
        props.setShiliuToken("test-token");
        ShiliuService service = new ShiliuService(props, new MockEnvironment(), mock(HttpShiliuGateway.class));

        service.assertTestModeSafe();
        assertTrue(service.required().mock());
    }

    @Test
    void productionProfileRefusesForceMockAtStartup() {
        ClipProperties props = new ClipProperties();
        props.setForceMock(true);
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");
        ShiliuService service = new ShiliuService(props, env, mock(HttpShiliuGateway.class));

        assertThrows(IllegalStateException.class, service::assertTestModeSafe);
        assertThrows(IllegalStateException.class, service::required);
    }
}
