package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlan;
import com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlanTestSupport;
import com.aistareco.aep.ipstudio.h3.H3PromptRewrite;
import com.aistareco.aep.ipstudio.h3.H3StudioPrompt;
import com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler;
import com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 真实出片前的准备（不默认跑，要钱）：拉片 → 每段提示词 → 代码拼方案并校验 → 每段按线上做法改写成 H3 官方格式。
 * 输出出片清单（每段的原片时间、参考素材顺序、最终交给 H3 的提示词），由脚本上传素材、提交 H3、合成。
 * <pre>
 * STUDIO_REAL_VIDEO=/a.mp4 STUDIO_REAL_REQUIREMENT=... STUDIO_REAL_MATERIALS='cup|杯子|image' STUDIO_REAL_OUT=/plan.json
 * STUDIO_REAL_BREAKDOWN_KEY=...(方舟) STUDIO_REAL_TEXT_KEY=...(OneToken) ./mvnw -Dtest=StudioRecreationRealPrepareTest test
 * </pre>
 */
@EnabledIfEnvironmentVariable(named="STUDIO_REAL_VIDEO",matches=".+")
class StudioRecreationRealPrepareTest {
    final ObjectMapper om=new ObjectMapper();
    final String textBase=env("STUDIO_REAL_TEXT_BASE","https://api.onetoken.love/v1"),textModel=env("STUDIO_REAL_TEXT_MODEL","gpt-6.1-terra-official");

    @Test
    void prepareARealRecreation() throws Exception {
        Path video=Path.of(System.getenv("STUDIO_REAL_VIDEO"));
        String requirement=env("STUDIO_REAL_REQUIREMENT","");
        double duration=Double.parseDouble(new String(new ProcessBuilder("ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",video.toString())
                .start().getInputStream().readAllBytes()).trim());
        ObjectNode log=om.createObjectNode();
        // 1. 拉片（Seed 2.0 Lite 看整条视频）
        var media=StudioVideoBreakdown.prepare(video,Files.createTempDirectory("real-recreation-"),duration);
        var prompt=StudioPromptAssembler.classpath().assemble(StudioPromptAssembler.Call.of(StudioPromptCallPoints.VIDEO_BREAKDOWN,
                Map.of("duration",StudioVideoBreakdown.fmt(duration),"cuts",StudioVideoBreakdown.cutsText(media.cuts()),"focus",requirement),null,null));
        Map<String,Object> body=new LinkedHashMap<>();
        body.put("model",env("STUDIO_REAL_BREAKDOWN_MODEL","doubao-seed-2-0-lite-260428"));body.put("max_tokens",16000);body.put("temperature",.2);
        body.put("reasoning_effort","minimal");body.put("response_format",Map.of("type","json_object"));
        body.put("messages",List.of(Map.of("role","system","content",prompt.system()),
                Map.of("role","user","content",List.of(StudioVideoBreakdown.videoPart(media.proxy()),Map.of("type","text","text",prompt.user())))));
        var reply=post(env("STUDIO_REAL_BREAKDOWN_BASE","https://ark.cn-beijing.volces.com/api/v3"),System.getenv("STUDIO_REAL_BREAKDOWN_KEY"),body,false);
        var breakdown=StudioVideoBreakdown.normalize(ModelJson.parse(om,reply.content),duration,media.cuts());
        log.set("breakdownUsage",reply.usage);
        var contract=StudioRecreationTaskPlanTestSupport.h3();
        var units=StudioVideoBreakdown.units(breakdown,contract.maxSeconds(),contract.minSeconds(),8);
        // 2. 每段提示词（线上默认文字模型）→ 拼方案 → 校验
        var film=om.createObjectNode();film.set("breakdown",breakdown);var segments=film.putArray("segments");
        for(var u:units)segments.addObject().put("no",u.no()).put("title",u.title()).put("startSec",u.startSec()).put("endSec",u.endSec())
                .put("firstShot",u.firstShot()).put("lastShot",u.lastShot()).put("storageKey","clip-"+u.no()).put("durationSec",u.length());
        List<StudioRecreationTaskPlan.Material> materials=new ArrayList<>();Map<String,String> titles=new LinkedHashMap<>();
        for(String m:env("STUDIO_REAL_MATERIALS","").split(";"))if(!m.isBlank()){String[] p=m.split("\\|");materials.add(new StudioRecreationTaskPlan.Material(p[0],p[1],p[2]));titles.put(p[0],p[1]);}
        var task=StudioRecreationTaskPlan.prepare(film,materials,"ai-jusuan-minimax-h3",contract,"768p","9:16",null);
        var compilePrompt=StudioPromptAssembler.classpath().assemble(StudioPromptAssembler.Call.of(StudioPromptCallPoints.RECREATION_COMPILE,
                StudioRecreationTaskPlan.variables(task,breakdown,requirement),null,null));
        var compiled=post(textBase,System.getenv("STUDIO_REAL_TEXT_KEY"),textBody(compilePrompt.system(),compilePrompt.user(),.5),true);
        log.set("compileUsage",compiled.usage);
        var plan=StudioRecreationTaskPlan.build(task,ModelJson.parse(om,compiled.content));
        Set<String> allowed=new HashSet<>(titles.keySet());for(var u:units)allowed.add("clip-"+u.no());
        var validated=StudioPlanValidator.validateSkillPlan(plan,StudioRecreationTaskPlanTestSupport.rules(),"production",allowed);
        // 3. 每段按线上做法改写（H3 默认开着「智能优化」）
        ObjectNode doc=om.createObjectNode();var nodes=doc.putArray("nodes");
        for(var u:units)nodes.addObject().put("title","参考视频 · 第 "+u.no()+" 段").putObject("metadata").put("storageKey","clip-"+u.no());
        titles.forEach((id,title)->nodes.addObject().put("title",title).putObject("metadata").put("storageKey",id));
        ObjectNode out=om.createObjectNode();out.put("source",video.toString()).put("durationSec",duration);
        out.set("breakdown",breakdown);out.set("plan",validated);out.set("log",log);
        var steps=out.putArray("steps");
        Map<String,JsonNode> unitByStep=new HashMap<>();for(JsonNode u:task.path("units"))unitByStep.put("v"+u.path("no").asInt(),u);
        for(JsonNode step:validated.path("steps")) {
            if(!"video".equals(step.path("operation").asText()))continue;
            JsonNode settings=step.path("settings"),unit=unitByStep.get(step.path("id").asText());
            List<VideoStudioReferenceInput> refs=new ArrayList<>();ObjectNode item=steps.addObject();var refOut=item.putArray("refs");
            List<JsonNode> bindings=new ArrayList<>();settings.path("referenceBindings").forEach(bindings::add);
            bindings.sort(Comparator.comparingInt(b->b.path("order").asInt()));
            for(JsonNode b:bindings) {
                String type=b.path("role").asText().equals("reference-video")?"video":b.path("role").asText().equals("reference-audio")?"audio":"image";
                refs.add(new VideoStudioReferenceInput(type,b.path("nodeId").asText()));refOut.addObject().put("type",type).put("key",b.path("nodeId").asText());
            }
            int seconds=settings.path("durationSec").asInt();
            var built=H3StudioPrompt.build(step.path("prompt").asText(),seconds,new VideoSettings("universal_reference_video","768p",null,null,null,refs,null,"auto"),doc);
            var h3=built.request();
            ObjectNode meta=H3PromptRewrite.meta(om,h3,built.pictures(),built.videos(),built.audios());
            String system=H3PromptRewrite.system(h3.mode(),h3.codeLines(),h3.shots()!=null);
            item.put("id",step.path("id").asText()).put("title",step.path("title").asText()).put("seconds",seconds)
                    .put("startSec",unit.path("startSec").asDouble()).put("endSec",unit.path("endSec").asDouble()).put("promptZh",step.path("prompt").asText());
            JsonNode result=null;
            for(int attempt=1;attempt<=2&&result==null;attempt++) {
                var rewritten=post(textBase,System.getenv("STUDIO_REAL_TEXT_KEY"),textBody(system,H3PromptRewrite.user(h3),.6),true);
                item.withArray("rewriteUsage").add(rewritten.usage);
                try{result=H3PromptRewrite.validate(om,meta,ModelJson.parse(om,rewritten.content));}
                catch(BusinessException|com.fasterxml.jackson.core.JsonProcessingException e){item.withArray("rewriteErrors").add(e.getMessage());}
            }
            boolean usable=result!=null&&result.path("usable").asBoolean(true);
            if(result!=null){item.set("rewriteWarnings",result.path("warnings"));item.set("rewriteNotes",result.path("notes"));}
            String finalPrompt=usable?H3PromptRewrite.fill(result.path("template").asText(),H3PromptRewrite.lines(meta),meta.path("language").asText("Chinese")):step.path("prompt").asText();
            if(usable&&finalPrompt.length()>H3PromptRewrite.MAX_PROMPT_CHARS){usable=false;finalPrompt=step.path("prompt").asText();}
            item.put("rewriteUsable",usable).put("prompt",finalPrompt);
        }
        for(JsonNode step:validated.path("steps"))if("assemble".equals(step.path("operation").asText()))out.set("captions",step.path("settings").path("captions"));
        Files.writeString(Path.of(System.getenv("STUDIO_REAL_OUT")),om.writerWithDefaultPrettyPrinter().writeValueAsString(out));
        assertTrue(steps.size()>=1);
    }

    private Map<String,Object> textBody(String system,String user,double temperature) {
        Map<String,Object> body=new LinkedHashMap<>();
        body.put("model",textModel);body.put("max_tokens",64000);body.put("temperature",temperature);body.put("reasoning_effort","low");
        body.put("stream",true);body.put("stream_options",Map.of("include_usage",true));
        body.put("messages",List.of(Map.of("role","system","content",system),Map.of("role","user","content",user)));
        return body;
    }

    record Reply(String content,JsonNode usage) {}

    /** 线上 Terra（OneToken）要流式、不认 response_format；方舟拉片一次返回。 */
    private Reply post(String base,String key,Map<String,Object> body,boolean stream) throws Exception {
        var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create(base+"/chat/completions")).timeout(Duration.ofMinutes(10))
                .header("Authorization","Bearer "+key).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,response.statusCode(),response.body());
        if(!stream){JsonNode r=om.readTree(response.body());return new Reply(r.path("choices").get(0).path("message").path("content").asText(),r.path("usage"));}
        StringBuilder text=new StringBuilder();JsonNode usage=om.nullNode();
        for(String line:response.body().split("\n")) {
            if(!line.startsWith("data:"))continue;String data=line.substring(5).trim();if(data.equals("[DONE]"))continue;
            JsonNode chunk=om.readTree(data);if(chunk.has("usage")&&!chunk.path("usage").isNull())usage=chunk.path("usage");
            for(JsonNode c:chunk.path("choices"))text.append(c.path("delta").path("content").asText(""));
        }
        return new Reply(text.toString(),usage);
    }

    private static String env(String name,String fallback){String v=System.getenv(name);return v==null||v.isBlank()?fallback:v;}
}
