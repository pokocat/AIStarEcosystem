package com.aistareco.aep.clip.service.shiliu;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MockShiliuGatewayTest {
    @Test
    void authorizationOutputRefFitsConsentEvidenceColumn() {
        ShiliuGateway.Task task = new MockShiliuGateway()
                .createAuthorizationVideo("owner", "clip/consent/test.mp4", "本人确认授权");

        assertEquals("succeeded", task.status());
        assertNotNull(task.outputRef());
        assertTrue(task.outputRef().length() <= 32, "dap_consent.capture_id is varchar(32)");
        assertFalse(task.outputRef().contains("://"), "engine refs are ids, not URLs");
    }
}
