package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueCanvasDigest;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.util.List;

/** Free: paged canvas catalog or paged node content. */
@Component
public class ReadCanvasTool implements StudioDialogueTool {
    public String name() { return "read_canvas"; }
    public String title() { return "查看画布"; }
    public String description() { return "免费读取画布。无 nodeIds 时分页读取对象目录；指定 nodeIds（最多8个）时分段读取正文。offset 从0开始；每个返回项的 nextOffset 非空表示还有内容，下一次带该 offset 读取，不能把片段当全文或重复读取同一段。"; }
    public ObjectNode parameters(ObjectMapper m) {
        var s = DialogueTools.schema(m);
        DialogueTools.prop(s, "nodeIds", "array", "要读取完整内容的对象 id").put("maxItems",8).putObject("items").put("type", "string");
        DialogueTools.prop(s, "offset", "integer", "起始位置：目录为对象序号；正文为字符位置，使用上次 nextOffset").put("minimum",0);
        DialogueTools.prop(s, "limit", "integer", "本次读取数量：目录默认120个；正文默认8000字，最多16000字").put("minimum",1).put("maximum",16000);
        return s;
    }
    public String validate(JsonNode args, ToolContext ctx) {
        if(args.has("nodeIds") && (!args.path("nodeIds").isArray() || args.path("nodeIds").size()>8))return "nodeIds 最多 8 个";
        for(String field:List.of("offset","limit"))if(args.has(field)&&(!args.path(field).canConvertToInt()||!args.path(field).isIntegralNumber()
                ||args.path(field).asInt()<(field.equals("offset")?0:1)))return field+" 必须是有效的非负位置或正数长度";
        return args.path("limit").asInt(1)>16000?"每次最多读取16000字":null;
    }
    public String safeInputSummary(JsonNode args, ToolContext ctx) {
        int n = args.path("nodeIds").size();
        return n == 0 ? "查看画布对象目录" : "读取 " + n + " 个对象的内容";
    }
    public ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) {
        JsonNode doc = ctx.effects.readDoc();
        List<String> ids = DialogueTools.strings(args.path("nodeIds"), 8);
        int count = DialogueCanvasDigest.nodeIds(doc).size();
        int offset=args.path("offset").asInt(0);
        var body=DialogueTools.OM.createObjectNode().put("count",count);
        if(ids.isEmpty()) {
            var nodes=IpDocs.nodes(doc);
            int start=Math.min(offset,nodes.size()),end=start+Math.min(Math.min(args.path("limit").asInt(120),120),nodes.size()-start);
            ObjectNode page=doc.deepCopy();var selected=page.putArray("nodes");nodes.subList(start,end).forEach(selected::add);
            body.put("digest",DialogueCanvasDigest.build(page,List.of(),List.of())).put("offset",start).put("hasMore",end<nodes.size());
            if(end<nodes.size())body.put("nextOffset",end);else body.putNull("nextOffset");
        } else {
            var parts=body.putArray("nodes");
            for(String id:ids) {
                var node=IpDocs.node(doc,id);var part=parts.addObject().put("id",id);
                if(node==null){part.put("missing",true);continue;}
                String text=DialogueCanvasDigest.excerpt(node);int total=text.codePointCount(0,text.length());
                int start=Math.min(offset,total),end=start+Math.min(args.path("limit").asInt(8000),total-start);
                part.put("title",node.path("title").asText()).put("type",node.path("type").asText())
                        .put("hasAdoptedContent",IpDocs.primaryStorageKey(node)!=null)
                        .put("offset",start).put("totalChars",total).put("hasMore",end<total)
                        .put("text",text.substring(text.offsetByCodePoints(0,start),text.offsetByCodePoints(0,end)));
                if(end<total)part.put("nextOffset",end);else part.putNull("nextOffset");
            }
        }
        return ToolRun.done(ids.isEmpty() ? "画布上有 " + count + " 个对象" : "已读取 " + ids.size() + " 个对象", DialogueTools.ok(body));
    }
}
