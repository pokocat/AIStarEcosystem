package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.Connection;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.NodeUpsertData;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RecreationSettings;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Paid analysis: segment the reference video through the native {@code recreation} run ({@code mode=segments},
 * {@code recreation.maxSegmentSec} from the skill, "model" = the selected video model's contract). The child run owns its
 * own hold and settlement; this tool only follows its real stage and reports the produced study.
 */
@Component
public class AnalyzeVideoTool implements StudioDialogueTool {
    static final Duration WAIT_FOR_NODE = Duration.ofSeconds(45);
    private final ChildRuns children;
    private final IpProjectService projects;
    private final StudioVideoService videos;

    public AnalyzeVideoTool(ChildRuns children, IpProjectService projects, StudioVideoService videos) {
        this.children = children; this.projects = projects; this.videos = videos;
    }

    public String name() { return "analyze_video"; }
    public String title() { return "拉片分析"; }
    public String description() { return "对画布上的参考视频做分段拉片分析（真实裁切与逐段读画面，不含音频转写）。收费，需要已授权的分析额度；结果写进画布上的拆解报告。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m, "sourceNodeId");
        DialogueTools.prop(s, "sourceNodeId", "string", "参考视频对象 id");
        DialogueTools.prop(s, "focus", "string", "分析重点，≤500 字");
        DialogueTools.prop(s, "videoModel", "string", "后续生成打算用的视频模型（决定每段最长秒数）；省略用默认模型");
        return s;
    }
    public String operation(JsonNode args) { return "recreation"; }
    public String validate(JsonNode args, ToolContext ctx) {
        JsonNode source = IpDocs.node(ctx.effects.readDoc(), DialogueTools.text(args, "sourceNodeId"));
        if (source == null || !"video".equals(source.path("type").asText())) return "请选择画布上的一条参考视频";
        if (IpDocs.primaryStorageKey(source) == null) return "这条视频还没有上传完成";
        if (args.path("focus").asText("").length() > 500) return "分析重点不超过 500 字";
        return null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) {
        JsonNode source = IpDocs.node(ctx.effects.readDoc(), DialogueTools.text(args, "sourceNodeId"));
        return "拉片「" + (source == null ? "参考视频" : DialogueTools.excerpt(source.path("title").asText("参考视频"), 30)) + "」";
    }

    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) throws Exception {
        String unavailable = children.unavailableReason(ctx);
        if (unavailable != null)
            return ToolRun.failed(ChildRuns.NOT_AUTHORIZED, unavailable, DialogueTools.fail("拉片分析是收费操作，目前" + unavailable
                    + "。不要声称已经开始分析；说明情况，需要时用 request_approval 请用户确认方案与预算。"));
        String sourceId = DialogueTools.text(args, "sourceNodeId");
        JsonNode doc = ctx.effects.readDoc();
        JsonNode source = IpDocs.node(doc, sourceId);
        String key = IpDocs.primaryStorageKey(source);
        projects.requireOwnedAssetKey(ctx.userId, key);
        String videoModel = DialogueTools.text(args, "videoModel");
        if (videoModel == null) videoModel = videos.models().stream().filter(m -> m.isDefault()).findFirst()
                .or(() -> videos.models().stream().findFirst()).map(m -> m.endpointId()).orElse(null);
        if (videoModel == null) return ToolRun.failed("VIDEO_NOT_CONFIGURED", "还没有可用的视频模型，不能确定每段时长上限", DialogueTools.fail("还没有可用的视频模型合同，拉片无法按模型时长分段"));
        String targetId = reportNode(doc, sourceId);
        if (targetId == null) {
            targetId = "dlg-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            ObjectNode node = DialogueTools.OM.createObjectNode().put("id", targetId).put("type", "text")
                    .put("title", "拆解 · " + DialogueTools.excerpt(source.path("title").asText("参考视频"), 40));
            node.putObject("position").put("x", source.path("position").path("x").asDouble(0) + source.path("width").asDouble(360) + 80)
                    .put("y", source.path("position").path("y").asDouble(0));
            node.put("width", 360).put("height", 320);
            ObjectNode md = node.putObject("metadata").put("content", "");
            md.putObject("studio").put("kind", "recreation").putObject("recreation").put("mode", "segments")
                    .put("sourceNodeId", sourceId).put("sourceStorageKey", key).put("sourceTitle", source.path("title").asText("参考视频"));
            ctx.createdNodeIds.add(targetId);
            ctx.effects.publishNodeUpserts(List.of(
                    new NodeUpsertData(targetId, "create", node, null, ctx.executionId, null, null, null, null),
                    new NodeUpsertData(targetId, "connect", null, new Connection(sourceId, targetId), ctx.executionId, null, null, null, null)));
            handle.progress("等待画布保存拆解报告");
            if (!awaitSaved(ctx, targetId))
                return ToolRun.failed("STUDIO_CANVAS_NOT_SAVED", "画布还没保存拆解报告，拉片没有开始", DialogueTools.fail("画布暂时没有保存新建的拆解报告，拉片没有提交、没有扣费。请让用户确认画布已打开并稍后重试。"));
        }
        String maxSegmentSec = ctx.skill() == null ? "model" : String.valueOf(ctx.skill().maxSegmentSec());
        var draft = ChildRuns.request(ChildRuns.requestId(ctx), targetId, "recreation",
                DialogueTools.text(args, "focus") == null ? "按参考视频复刻方法分段拉片" : DialogueTools.text(args, "focus"),
                null, ctx.endpoint == null ? null : ctx.endpoint.getId(), null, null, null, "segments", List.of(sourceId),
                new RecreationSettings(maxSegmentSec, videoModel), ctx);
        var child = children.submit(ctx, draft, handle);
        ctx.effects.publishNodeUpserts(List.of(new NodeUpsertData(targetId, "update", null, null, ctx.executionId, null, child.id(), null, null)));
        IpRun last = children.follow(ctx, child.id(), Duration.ofSeconds(2), run -> handle.progress(progress(run)));
        JsonNode output = ChildRuns.parse(last.getOutputJson());
        int segments = output.path("filmStudy").path("segments").size();
        if (IpRun.STATUS_DONE.equals(last.getStatus())) {
            var body = DialogueTools.OM.createObjectNode().put("runId", last.getId()).put("reportNodeId", targetId).put("segments", segments)
                    .put("summary", DialogueTools.excerpt(output.path("text").asText(""), 6000));
            return new ToolRun("done", "已切成 " + segments + " 段", DialogueTools.ok(body), List.of(targetId), List.of(), last.getId(),
                    last.getCost(), false, null, null, null);
        }
        if (IpRun.STATUS_FAILED.equals(last.getStatus()))
            return new ToolRun("failed", last.getErrorMessage() == null ? "拉片没有完成" : last.getErrorMessage(),
                    DialogueTools.fail("拉片没有完成：" + (last.getErrorMessage() == null ? last.getErrorCode() : last.getErrorMessage())),
                    List.of(targetId), List.of(), last.getId(), last.getCost(), false, last.getErrorCode(), last.getErrorMessage(), null);
        // Still queued or running after the follow window: the task does not wait any longer. The model tells the user it
        // was submitted and lands on the canvas by itself, and the turn ends normally (no limit, nothing to 「继续」).
        var body = DialogueTools.OM.createObjectNode().put("runId", last.getId()).put("reportNodeId", targetId)
                .put("summary", "已提交，" + ChildRuns.stageLabel(last) + "，结果会自动放进画布的拆解报告。告诉用户这件事，这一轮不要再等它，也不要重复提交。");
        return new ToolRun("running", "已提交，" + ChildRuns.stageLabel(last) + "，结果会自动放进画布", DialogueTools.ok(body), List.of(targetId), List.of(), last.getId(),
                null, true, null, null, null);
    }

    private boolean awaitSaved(ToolContext ctx, String nodeId) throws InterruptedException {
        long until = System.nanoTime() + WAIT_FOR_NODE.toNanos();
        while (System.nanoTime() < until && !ctx.stopped()) {
            if (IpDocs.node(ctx.effects.readDoc(), nodeId) != null) return true;
            Thread.sleep(1500);
        }
        return false;
    }

    static String reportNode(JsonNode doc, String sourceId) {
        for (JsonNode n : IpDocs.nodes(doc)) {
            JsonNode studio = n.path("metadata").path("studio");
            if ("text".equals(n.path("type").asText()) && "recreation".equals(studio.path("kind").asText())
                    && sourceId.equals(studio.path("recreation").path("sourceNodeId").asText())) return n.path("id").asText();
        }
        return null;
    }

    private static String progress(IpRun run) {
        JsonNode segments = ChildRuns.parse(run.getOutputJson()).path("filmStudy").path("segments");
        if (segments.isArray() && !segments.isEmpty()) {
            int done = 0;
            for (JsonNode s : segments) if ("done".equals(s.path("status").asText())) done++;
            return ChildRuns.stageLabel(run) + " · 已切成 " + segments.size() + " 段，已读完 " + done + " 段";
        }
        return ChildRuns.stageLabel(run);
    }
}
