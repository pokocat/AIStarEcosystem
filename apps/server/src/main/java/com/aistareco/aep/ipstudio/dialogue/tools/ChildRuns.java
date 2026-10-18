package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueLoop;
import com.aistareco.aep.ipstudio.dialogue.StudioExecutionGate;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;

/**
 * Paid native child runs started by dialogue tools. Every child goes through {@link StudioWorkflowService#submit} (its
 * own preflight, price check, hold, afterCommit dispatch and settlement) and only after the plan executor's
 * {@link StudioExecutionGate} bound the execution's billing selection and approved per-step cost. Without a gate or an
 * active execution nothing is submitted and nothing is frozen.
 */
@Component
public class ChildRuns {
    public static final String NOT_AUTHORIZED = "STUDIO_PRODUCTION_NOT_AUTHORIZED";
    private final StudioWorkflowService workflow;
    private final IpRunRepository runs;
    private final Optional<StudioExecutionGate> gate;

    public ChildRuns(StudioWorkflowService workflow, IpRunRepository runs, Optional<StudioExecutionGate> gate) {
        this.workflow = workflow; this.runs = runs; this.gate = gate;
    }

    /** Why a paid child cannot be submitted right now, or null when the gate and an execution are in place. */
    public String unavailableReason(ToolContext ctx) {
        if (ctx.mock) return "测试响应模式不提交收费任务";
        if (gate.isEmpty()) return "制作尚未授权：后台制作服务还没有开放，这一步不能由对话直接提交";
        if (ctx.executionId == null) return "制作尚未授权：需要先确认方案和预算";
        return null;
    }

    /** Authorize through the gate, submit natively, and record the child on the execution and the parent checkpoint. */
    public IpRunDto submit(ToolContext ctx, RunRequest draft, ToolHandle handle) {
        String reason = unavailableReason(ctx);
        if (reason != null) throw new BusinessException(org.springframework.http.HttpStatus.FORBIDDEN, NOT_AUTHORIZED, reason);
        RunRequest authorized = gate.get().authorizeChild(ctx.userId, ctx.projectId, ctx.executionId, ctx.stage(), draft);
        if (authorized == null || !Objects.equals(authorized.operation(), draft.operation()) || !Objects.equals(authorized.clientRequestId(), draft.clientRequestId()))
            throw new IllegalStateException("execution gate changed the child request identity");
        IpRunDto child = workflow.submit(ctx.userId, ctx.projectId, authorized);
        gate.get().childAccepted(ctx.userId, ctx.projectId, ctx.executionId, authorized.clientRequestId(), child.id());
        ctx.effects.checkpointChild(child.id());
        handle.childRun(child.id());
        return child;
    }

    /**
     * Follow a child run until it is terminal, the turn deadline passes or the user stops. Progress strings come from the
     * child's own stage and persisted partial output only. Returns the latest row (possibly still running).
     */
    public IpRun follow(ToolContext ctx, String runId, Duration poll, Consumer<IpRun> onChange) throws InterruptedException {
        String last = null;
        while (true) {
            IpRun run = runs.findById(runId).orElseThrow(() -> new IllegalStateException("child run missing " + runId));
            String signature = run.getStatus() + "|" + run.getStage() + "|" + run.getPct() + "|" + (run.getOutputJson() == null ? 0 : run.getOutputJson().length());
            if (!signature.equals(last)) { last = signature; onChange.accept(run); }
            if (!IpRun.STATUS_RUNNING.equals(run.getStatus())) return run;
            if (ctx.stopped() || ctx.budget.remainingTime().compareTo(poll) <= 0) return run;
            Thread.sleep(poll.toMillis());
        }
    }

    public static String requestId(ToolContext ctx) { return "dlg-" + ctx.turnId + "-" + ctx.nextSequence(); }

    public static RunRequest request(String clientRequestId, String nodeId, String operation, String prompt,
                                     java.util.List<com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Reference> references,
                                     String model, Integer durationSec, String aspectRatio, Integer count, String mode,
                                     java.util.List<String> contextNodeIds,
                                     com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RecreationSettings recreation,
                                     ToolContext ctx) {
        var skill = ctx.skill();
        return new RunRequest(clientRequestId, nodeId, operation, prompt, references, model, null, durationSec, aspectRatio, count,
                null, null, mode, contextNodeIds, null, null, null, null, null, null, null, null, recreation, null,
                skill == null ? null : skill.key(), skill == null ? null : skill.version(), ctx.stage(), ctx.executionId, null);
    }

    static String stageLabel(IpRun run) {
        String stage = run.getStage() == null ? "" : run.getStage();
        if (stage.equals("endpoint.queued") || stage.equals("queued")) return "排队中";
        if (stage.startsWith("recreation.audio")) return "正在提取原声";
        if (stage.startsWith("recreation.frames")) return "正在抽取画面";
        if (stage.startsWith("recreation.read")) return "正在读取画面";
        if (stage.startsWith("recreation.summarize")) return "正在整理分析";
        if (stage.startsWith("film.plan")) return "正在规划分段";
        if (stage.startsWith("film.cut")) return "正在按段裁切";
        if (stage.startsWith("film.analyze")) return "正在逐段分析";
        if (stage.equals("done")) return "已完成";
        if (stage.equals("failed")) return "没有完成";
        return "处理中";
    }

    static DialogueLoop.Reason endFor(IpRun run) {
        return IpRun.STATUS_RUNNING.equals(run.getStatus()) ? DialogueLoop.Reason.HANDED_OFF : null;
    }

    static JsonNode parse(String json) {
        try { return json == null ? DialogueTools.OM.createObjectNode() : DialogueTools.OM.readTree(json); }
        catch (Exception e) { return DialogueTools.OM.createObjectNode(); }
    }
}
