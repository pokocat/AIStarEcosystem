package com.aistareco.aep.clip;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.security.ClipServiceIdentity;
import com.aistareco.aep.clip.service.shiliu.HttpShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ClipServiceIdentityTest {

    @Test
    void serviceTokenAndExternalOwnerAreBothRequired() {
        ClipProperties props = new ClipProperties();
        props.setServiceToken("service-secret");
        ClipServiceIdentity identity = new ClipServiceIdentity(props);

        BusinessException unauthorized = assertThrows(BusinessException.class,
                () -> identity.require(null, "owner-001", null));
        assertEquals("CLIP_SERVICE_UNAUTHORIZED", unauthorized.getCode());

        BusinessException invalidOwner = assertThrows(BusinessException.class,
                () -> identity.require("Bearer service-secret", "../other", null));
        assertEquals("CLIP_EXTERNAL_OWNER_REQUIRED", invalidOwner.getCode());

        var owner = identity.require("Bearer service-secret", "owner-001", "tenant-001");
        assertEquals("owner-001", owner.externalOwnerId());
        assertEquals("tenant-001", owner.externalTenantId());
    }

    @Test
    void productionProfileNeverFallsBackToMockEngine() {
        ClipProperties props = new ClipProperties();
        props.setAllowMock(true);
        Environment env = mock(Environment.class);
        when(env.getActiveProfiles()).thenReturn(new String[]{"mysql"});
        ShiliuService service = new ShiliuService(props, env, mock(HttpShiliuGateway.class));

        BusinessException error = assertThrows(BusinessException.class, service::required);
        assertEquals("CLIP_ENGINE_NOT_CONFIGURED", error.getCode());
    }
}
