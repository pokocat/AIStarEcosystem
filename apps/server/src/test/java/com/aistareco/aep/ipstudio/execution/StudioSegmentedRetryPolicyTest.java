package com.aistareco.aep.ipstudio.execution;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class StudioSegmentedRetryPolicyTest {
    final ObjectMapper json=new ObjectMapper();
    @Test void unusableModelContentKeepsItsReceiptAndDoesNotScheduleAnotherPaidAttempt() throws Exception {
        var state=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree("""
            {"videoTask":{"kind":"recreation"},"steps":[{"id":"study","operation":"recreation","stage":"analysis","status":"failed","errorCode":"AI_BAD_OUTPUT","attempt":1,"runIds":["IPR-original"]}]}
            """);
        var execution=new IpPlanExecution();execution.setId("PEX-test");execution.setStage("analysis");
        new StudioSegmentedRun(mock(StudioPlanOutputs.class),json).prepare(execution,state);
        var step=state.path("steps").get(0);
        assertEquals("failed",step.path("status").asText());assertEquals(1,step.path("attempt").asInt());
        assertEquals("IPR-original",step.path("runIds").get(0).asText());assertFalse(step.has("notBefore"));
    }
    @Test void transientTransportFailureStillSchedulesADelayedRetry() throws Exception {
        var state=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree("""
            {"videoTask":{},"steps":[{"id":"study","operation":"recreation","stage":"analysis","status":"failed","errorCode":"AI_CALL_FAILED","attempt":1,"runIds":["IPR-failed"]}]}
            """);
        var execution=new IpPlanExecution();execution.setId("PEX-test");execution.setStage("analysis");
        new StudioSegmentedRun(mock(StudioPlanOutputs.class),json).prepare(execution,state);
        var step=state.path("steps").get(0);assertEquals("pending",step.path("status").asText());
        assertEquals(2,step.path("attempt").asInt());assertTrue(step.hasNonNull("notBefore"));
    }

    @Test void oversizedVideoReferenceDoesNotScheduleAnotherPaidAttempt() throws Exception {
        var state=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree("""
            {"videoTask":{},"steps":[{"id":"clip","operation":"video","stage":"production","status":"failed","errorCode":"VIDEO_REF_IMAGE_SIZE_INVALID","attempt":1,"runIds":["IPR-original"]}]}
            """);
        var execution=new IpPlanExecution();execution.setId("PEX-test");execution.setStage("production");
        new StudioSegmentedRun(mock(StudioPlanOutputs.class),json).prepare(execution,state);
        var step=state.path("steps").get(0);
        assertEquals("failed",step.path("status").asText());assertEquals(1,step.path("attempt").asInt());
        assertFalse(step.has("notBefore"));
    }
}
