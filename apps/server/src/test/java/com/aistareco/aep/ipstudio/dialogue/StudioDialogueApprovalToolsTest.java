package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.ipstudio.dialogue.tools.ConfirmApprovalTool;
import com.aistareco.aep.ipstudio.dialogue.tools.RequestApprovalTool;
import com.aistareco.aep.ipstudio.dialogue.tools.ToolContext;
import com.aistareco.aep.ipstudio.dialogue.tools.ToolHandle;
import com.aistareco.aep.service.AiChatTokenPricing;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** D04 confirm_approval (the user's message is the authority, the server checks everything) and the default card cap (D06). */
class StudioDialogueApprovalToolsTest {
    final ObjectMapper om = new ObjectMapper();
    static final ToolHandle HANDLE = new ToolHandle() {
        public String toolCallId() { return "tc-1"; }
        public void progress(String text) { }
        public void childRun(String runId) { }
    };

    ToolContext context(boolean mock, AiChatTokenPricing.Rate rate, ToolContext.Effects effects) {
        return new ToolContext("u1", "P1", "IPT-P1", "TRN-1", "IPR-1", "IDM-A", "IDM-U", null, null, mock, null, rate,
                DialogueLoop.TurnBudget.unmetered(1024, Clock.systemUTC()), null, "analysis", () -> false, effects);
    }

    @Test void confirmApprovalBindsTheUsersOwnMessageOfThisTurnAndReportsServerRefusals() throws Exception {
        var messages = mock(IpDialogueMessageRepository.class);
        Instant now = Instant.now();
        when(messages.findByThreadIdOrderBySeqDesc(eq("IPT-P1"), any())).thenReturn(List.of(
                IpDialogueMessage.builder().id("IDM-queued").threadId("IPT-P1").seq(5).role("user").turnId("TRN-1").status("queued").text("等等").createdAt(now).build(),
                IpDialogueMessage.builder().id("IDM-A").threadId("IPT-P1").seq(4).role("assistant").turnId("TRN-1").status("streaming").text("").createdAt(now).build(),
                IpDialogueMessage.builder().id("IDM-U").threadId("IPT-P1").seq(3).role("user").turnId("TRN-1").status("done").text("就按这个开始，上限 280").createdAt(now).build()));
        var gate = mock(StudioExecutionGate.class);
        @SuppressWarnings("unchecked") ObjectProvider<StudioExecutionGate> gates = mock(ObjectProvider.class);
        when(gates.getIfAvailable()).thenReturn(gate);
        var tool = new ConfirmApprovalTool(gates, messages);
        ObjectNode args = om.createObjectNode().put("approvalId", "APV-1").put("budgetCap", 280);
        assertNull(tool.validate(args, context(false, null, null)));
        assertNotNull(tool.validate(om.createObjectNode().put("approvalId", "APV-1").put("budgetCap", -1), context(false, null, null)));

        when(gate.confirmFromDialogue(eq("u1"), eq("P1"), any())).thenReturn(null);
        var run = tool.run(args, context(false, null, null), HANDLE);
        assertEquals("done", run.status());
        var approval = ArgumentCaptor.forClass(StudioExecutionGate.NaturalApproval.class);
        verify(gate).confirmFromDialogue(eq("u1"), eq("P1"), approval.capture());
        assertEquals("IDM-U", approval.getValue().userMessageId(), "the newest message the model has read, never the queued one");
        assertEquals(280L, approval.getValue().budgetCap());
        assertNull(approval.getValue().autoFixCap(), "a number the user did not say is left to the card");
        assertTrue(approval.getValue().clientRequestId().matches("nl-[0-9a-f]{40}"));
        tool.run(args, context(false, null, null), HANDLE);
        var again = ArgumentCaptor.forClass(StudioExecutionGate.NaturalApproval.class);
        verify(gate, times(2)).confirmFromDialogue(eq("u1"), eq("P1"), again.capture());
        assertEquals(again.getAllValues().get(0).clientRequestId(), again.getAllValues().get(1).clientRequestId(), "a repeated call is the same request");

        reset(gate);
        when(gate.confirmFromDialogue(any(), any(), any())).thenThrow(new BusinessException(HttpStatus.CONFLICT, "STUDIO_PLAN_STALE", "方案已经更新到新的一版"));
        var refused = tool.run(args, context(false, null, null), HANDLE);
        assertEquals("failed", refused.status());
        assertEquals("STUDIO_PLAN_STALE", refused.errorCode());
        assertTrue(refused.forModel().contains("\"ok\":false"));
        assertEquals("failed", tool.run(args, context(true, null, null), HANDLE).status(), "fixture mode never starts paid work");
    }

    /** 2026-10-23: the card covers the paid steps only; dialogue turns are billed on their own (no dialogue reserve). */
    @Test void theDefaultCardCapCoversThePaidStepsOnly() throws Exception {
        List<ObjectNode> appended = new ArrayList<>();
        var plan = om.createObjectNode().put("type", "plan").put("fingerprint", "fp").put("revision", 2).put("planRunId", "IPR-1");
        plan.putObject("plan").put("stage", "analysis").putObject("budget").put("estimated", 30).put("autoFixCap", 0);
        var effects = mock(ToolContext.Effects.class);
        when(effects.latestPlanBlock()).thenReturn(Optional.of(plan));
        doAnswer(i -> { appended.add(i.getArgument(0)); return null; }).when(effects).appendBlock(any(), any(), any());
        var rate = new AiChatTokenPricing.Rate(BigDecimal.ONE, BigDecimal.valueOf(2), 10_000, 2_000); // maxCost = 14
        var tool = new RequestApprovalTool();
        ObjectNode args = om.createObjectNode();
        args.putArray("scope").add("两步文字分析");
        tool.run(args, context(false, rate, effects), HANDLE);
        JsonNode card = appended.get(0);
        assertEquals(30, card.path("quotedCost").asLong());
        assertEquals(30, card.path("budgetCap").asLong(), "quote + redo, nothing reserved for the dialogue");
        assertFalse(card.has("dialogueReserve"));
        args.put("budgetCap", 30);
        tool.run(args, context(false, rate, effects), HANDLE);
        assertEquals(30, appended.get(1).path("budgetCap").asLong(), "a cap the user named is used as is");
        assertFalse(appended.get(1).has("dialogueReserve"));
    }
    @Test void aFailedReplacementPlanCannotConfirmThePreviousImagePlan() throws Exception {
        var effects = mock(ToolContext.Effects.class);
        var old = om.createObjectNode().put("planRunId", "IPR-old").put("fingerprint", "old-image");
        old.putObject("plan").putObject("budget").put("estimated", 30);
        when(effects.latestPlanBlock()).thenReturn(Optional.of(old));
        var ctx = context(false, null, effects);
        ctx.planAttempted = true;
        var args = om.createObjectNode(); args.putArray("scope").add("发布会视频");
        var result = new RequestApprovalTool().run(args, ctx, HANDLE);
        assertEquals("failed", result.status());
        assertNull(result.end(), "the loop must correct the plan in this turn rather than stop for the user");
        assertTrue(result.forModel().contains("重新 propose_plan"));
        verify(effects, never()).appendBlock(any(), any(), any());
        ctx.planAttempted = false;
        assertEquals("failed", new RequestApprovalTool().run(args, ctx, HANDLE).status(), "even without a planning attempt an old run cannot be reissued as new work");
    }

}
