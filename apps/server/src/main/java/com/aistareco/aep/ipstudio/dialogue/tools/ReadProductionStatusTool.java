package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.util.HashSet;
import java.util.Set;

/** Read the same native-job projection as the canvas, never infer completion from a binding row or a title. */
@Component
public class ReadProductionStatusTool implements StudioDialogueTool {
    private final IpProjectService projects;
    private final IpRunRepository runs;
    public ReadProductionStatusTool(IpProjectService projects, IpRunRepository runs) { this.projects=projects;this.runs=runs; }
    public String name() { return "read_production_status"; }
    public String title(){return "查看制作进度";}
    public String description(){return "免费查询当前画布各对象的最新制作结果、排队及失败状态。用户问做到哪里、缺什么、下一步时先查此工具；已有采用内容与最新一次制作状态分开，不按标题或受理记录判断已完成。";}
    public ObjectNode parameters(ObjectMapper mapper){return DialogueTools.schema(mapper);}
    public String safeInputSummary(JsonNode args,ToolContext ctx){return "核对当前画布的真实制作进度";}
    public ToolRun run(JsonNode args,ToolContext ctx,ToolHandle handle) {
        projects.required(ctx.userId,ctx.projectId);
        JsonNode doc=ctx.effects.readDoc();
        var body=DialogueTools.OM.createObjectNode();var items=body.putArray("items");
        var recent=runs.findByProjectIdOrderByCreatedAtDesc(ctx.projectId);
        Set<String> seen=new HashSet<>();
        for(var run:recent) {
            if(!ctx.userId.equals(run.getOwnerUserId())||"studio-dialogue".equals(run.getKind()))continue;
            JsonNode node=IpDocs.node(doc,run.getNodeId());
            if(node==null||!seen.add(run.getNodeId()))continue;
            var view=projects.toRunDto(run); // Includes native video terminal state and queue position.
            var item=items.addObject().put("nodeId",run.getNodeId()).put("title",node.path("title").asText("未命名"))
                    .put("type",node.path("type").asText()).put("latestStatus",view.status()).put("stage",view.stage())
                    .put("progress",view.pct()).put("hasAdoptedContent",IpDocs.primaryStorageKey(node)!=null)
                    .put("createdAt",view.createdAt()).put("finishedAt",view.finishedAt());
            if(view.errorCode()!=null)item.put("errorCode",view.errorCode());
            if(view.queue()!=null)item.set("queue",DialogueTools.OM.valueToTree(view.queue()));
        }
        for(var node:IpDocs.nodes(doc)) {
            String id=node.path("id").asText();
            if(!Set.of("image","video","audio").contains(node.path("type").asText())||seen.contains(id))continue;
            boolean adopted=IpDocs.primaryStorageKey(node)!=null;
            items.addObject().put("nodeId",id).put("title",node.path("title").asText("未命名"))
                    .put("type",node.path("type").asText()).put("latestStatus","no_task").put("hasAdoptedContent",adopted);
        }
        body.put("guidance","已有采用内容不等于最新一次任务成功；no_task 表示没有本平台制作记录。只报告本次查到的对象，不推测未建镜头。不要把同一对象同时列为已完成和缺失。");
        return ToolRun.done("已核对 "+items.size()+" 个对象的制作状态",DialogueTools.ok(body));
    }
}
