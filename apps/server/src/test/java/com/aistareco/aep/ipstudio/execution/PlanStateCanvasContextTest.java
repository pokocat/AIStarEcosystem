package com.aistareco.aep.ipstudio.execution;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 2026-10-18 production: the analysis plan was confirmed in a turn without attachments, so the execution recorded no canvas
 * context and the production planning run was refused for naming the user's own photo. Canvas nodes the confirmed steps
 * name count as context.
 */
class PlanStateCanvasContextTest {
    @Test void canvasNodesNamedByTheConfirmedStepsJoinTheRecordedContext() throws Exception {
        var state = new ObjectMapper().readTree("""
                {"canvasContextIds":["pinned"],
                 "steps":[{"id":"cut","stage":"analysis","definition":{"operation":"recreation","referenceNodeIds":["photo"],"settings":{"sourceNodeId":"video"}}},
                          {"id":"img","stage":"production","definition":{"operation":"image","settings":{"referenceBindings":[{"nodeId":"product","role":"product","order":0},{"stepId":"cut","role":"frame","order":1}]}}},
                          {"id":"fix","stage":"production","definition":{"operation":"text","settings":{"purpose":"script","editTarget":{"nodeId":"script","field":"content"}}}}]}""");
        assertEquals(List.of("pinned", "photo", "video", "product", "script"), PlanState.canvasContext(state));
    }
}
