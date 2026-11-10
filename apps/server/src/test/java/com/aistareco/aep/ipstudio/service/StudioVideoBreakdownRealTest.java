package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler;
import com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * 真实模型跑一遍拉片 v2（不默认跑，要钱）：本机 ffmpeg 压缩和测切镜、提示词库拼出的提示词、真实视频理解模型、解析与分段。
 * <pre>
 * STUDIO_BREAKDOWN_E2E_VIDEO=/path/a.mp4 STUDIO_BREAKDOWN_E2E_KEY=... [STUDIO_BREAKDOWN_E2E_MODEL=doubao-seed-2-0-lite-260428]
 * [STUDIO_BREAKDOWN_E2E_BASE=https://ark.cn-beijing.volces.com/api/v3] [STUDIO_BREAKDOWN_E2E_OUT=/tmp/report.md] ./mvnw -Dtest=StudioVideoBreakdownRealTest test
 * </pre>
 */
@EnabledIfEnvironmentVariable(named="STUDIO_BREAKDOWN_E2E_VIDEO",matches=".+")
class StudioVideoBreakdownRealTest {
    final ObjectMapper om=new ObjectMapper();

    @Test
    void aRealVideoBecomesShotsUnitsAndAReport() throws Exception {
        Path video=Path.of(System.getenv("STUDIO_BREAKDOWN_E2E_VIDEO"));
        String key=System.getenv("STUDIO_BREAKDOWN_E2E_KEY");
        String model=Optional.ofNullable(System.getenv("STUDIO_BREAKDOWN_E2E_MODEL")).orElse("doubao-seed-2-0-lite-260428");
        String base=Optional.ofNullable(System.getenv("STUDIO_BREAKDOWN_E2E_BASE")).orElse("https://ark.cn-beijing.volces.com/api/v3");
        double duration=Double.parseDouble(new String(new ProcessBuilder("ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",video.toString())
                .start().getInputStream().readAllBytes()).trim());
        Path dir=Files.createTempDirectory("breakdown-e2e-");
        var media=StudioVideoBreakdown.prepare(video,dir,duration);
        var prompt=StudioPromptAssembler.classpath().assemble(StudioPromptAssembler.Call.of(StudioPromptCallPoints.VIDEO_BREAKDOWN,
                Map.of("duration",StudioVideoBreakdown.fmt(duration),"cuts",StudioVideoBreakdown.cutsText(media.cuts()),
                        "focus",Optional.ofNullable(System.getenv("STUDIO_BREAKDOWN_E2E_FOCUS")).orElse("")),null,null));
        Map<String,Object> body=new LinkedHashMap<>();
        body.put("model",model);body.put("max_tokens",16000);body.put("temperature",.2);body.put("reasoning_effort","minimal");
        body.put("response_format",Map.of("type","json_object"));
        body.put("messages",List.of(Map.of("role","system","content",prompt.system()),
                Map.of("role","user","content",List.of(StudioVideoBreakdown.videoPart(media.proxy()),Map.of("type","text","text",prompt.user())))));
        long t=System.nanoTime();
        var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create(base+"/chat/completions")).timeout(Duration.ofMinutes(5))
                .header("Authorization","Bearer "+key).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,response.statusCode(),response.body());
        JsonNode reply=om.readTree(response.body());
        var breakdown=StudioVideoBreakdown.normalize(ModelJson.parse(om,reply.path("choices").get(0).path("message").path("content").asText()),duration,media.cuts());
        var units=StudioVideoBreakdown.units(breakdown,15,4,8);
        String report=StudioVideoBreakdown.report(breakdown);
        StringBuilder out=new StringBuilder(report).append("\n\n---\n用时 ").append((System.nanoTime()-t)/1_000_000).append(" ms，用量 ").append(reply.path("usage")).append("\n\n");
        for(var u:units)out.append(StudioVideoBreakdown.unitMarkdown(breakdown,u)).append('\n');
        String compileModel=System.getenv("STUDIO_BREAKDOWN_E2E_COMPILE_MODEL");
        if(compileModel!=null)out.append("\n\n========== 每段提示词 ==========\n\n").append(compile(breakdown,units,
                Optional.ofNullable(System.getenv("STUDIO_BREAKDOWN_E2E_COMPILE_KEY")).orElse(key),
                Optional.ofNullable(System.getenv("STUDIO_BREAKDOWN_E2E_COMPILE_BASE")).orElse(base),compileModel));
        String target=System.getenv("STUDIO_BREAKDOWN_E2E_OUT");
        if(target!=null)Files.writeString(Path.of(target),out.toString());
        System.out.println(out);
        assertFalse(breakdown.path("shotsFromCuts").asBoolean(),"模型给出了可用的镜头表");
        assertTrue(breakdown.path("shots").size()>=1);
        assertEquals(duration,units.get(units.size()-1).endSec(),.01);
    }

    /** 第二步：每段提示词（stage-recreation-compile）→ 代码拼方案 → 方案校验。素材是假设的人物和商品（只用名字）。 */
    private String compile(JsonNode breakdown,List<StudioVideoBreakdown.Unit> units,String key,String base,String model) throws Exception {
        var film=om.createObjectNode();film.set("breakdown",breakdown);var segments=film.putArray("segments");
        for(var u:units)segments.addObject().put("no",u.no()).put("title",u.title()).put("startSec",u.startSec()).put("endSec",u.endSec())
                .put("firstShot",u.firstShot()).put("lastShot",u.lastShot()).put("storageKey","clip-"+u.no()).put("durationSec",u.length());
        var materials=List.of(new com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlan.Material("person","小美（短发女生）","character"),
                new com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlan.Material("product","新商品","image"));
        var task=com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlan.prepare(film,materials,"h3",
                com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlanTestSupport.h3(),"768p","9:16",null);
        var vars=com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlan.variables(task,breakdown,
                Optional.ofNullable(System.getenv("STUDIO_BREAKDOWN_E2E_FOCUS")).orElse(""));
        var prompt=StudioPromptAssembler.classpath().assemble(StudioPromptAssembler.Call.of(StudioPromptCallPoints.RECREATION_COMPILE,vars,null,null));
        // 线上 Terra（OneToken）不认 response_format、要流式（约 105 秒不出字就断）、思考强度 low，和接入点配置一致
        boolean stream="1".equals(System.getenv("STUDIO_BREAKDOWN_E2E_COMPILE_STREAM"));
        Map<String,Object> body=new LinkedHashMap<>();
        body.put("model",model);body.put("max_tokens",stream?64000:16000);body.put("temperature",.5);
        body.put("reasoning_effort",Optional.ofNullable(System.getenv("STUDIO_BREAKDOWN_E2E_COMPILE_EFFORT")).orElse("minimal"));
        if(!stream)body.put("response_format",Map.of("type","json_object"));else{body.put("stream",true);body.put("stream_options",Map.of("include_usage",true));}
        body.put("messages",List.of(Map.of("role","system","content",prompt.system()),Map.of("role","user","content",prompt.user())));
        long t=System.nanoTime();
        var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create(base+"/chat/completions")).timeout(Duration.ofMinutes(10))
                .header("Authorization","Bearer "+key).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,response.statusCode(),response.body());
        String content;JsonNode usage;
        if(stream) {
            StringBuilder text=new StringBuilder();JsonNode last=om.nullNode();
            for(String line:response.body().split("\n")) {
                if(!line.startsWith("data:"))continue;String data=line.substring(5).trim();if(data.equals("[DONE]"))continue;
                JsonNode chunk=om.readTree(data);if(chunk.has("usage")&&!chunk.path("usage").isNull())last=chunk.path("usage");
                for(JsonNode c:chunk.path("choices"))text.append(c.path("delta").path("content").asText(""));
            }
            content=text.toString();usage=last;
        }else{JsonNode r=om.readTree(response.body());content=r.path("choices").get(0).path("message").path("content").asText();usage=r.path("usage");}
        String raw=System.getenv("STUDIO_BREAKDOWN_E2E_OUT");
        if(raw!=null)Files.writeString(Path.of(raw+".compile.json"),content);
        var answer=ModelJson.parse(om,content);
        var plan=com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlan.build(task,answer);
        Set<String> allowed=new HashSet<>(List.of("person","product"));for(var u:units)allowed.add("clip-"+u.no());
        var validated=StudioPlanValidator.validateSkillPlan(plan,com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlanTestSupport.rules(),"production",allowed);
        StringBuilder out=new StringBuilder("用时 ").append((System.nanoTime()-t)/1_000_000).append(" ms，用量 ").append(usage).append("\n\n");
        for(JsonNode step:validated.path("steps")) {
            out.append("## ").append(step.path("id").asText()).append(" · ").append(step.path("title").asText()).append("（").append(step.path("settings").path("durationSec").asText("")).append(" 秒）\n");
            for(JsonNode r:step.path("settings").path("referenceBindings"))out.append("- 参考 ").append(r.path("role").asText()).append(" ").append(r.path("nodeId").asText()).append('\n');
            if(step.path("settings").has("captions"))out.append("字幕：").append(step.path("settings").path("captions")).append('\n');
            out.append(step.path("prompt").asText()).append("\n\n");
        }
        return out.toString();
    }
}
