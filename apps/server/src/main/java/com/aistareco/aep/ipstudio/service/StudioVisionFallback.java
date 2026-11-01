package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.ai.AiChatHttpException;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Only a positively identified visual-memory rejection authorizes these extra model calls. */
final class StudioVisionFallback {
    private static final ObjectMapper JSON = new ObjectMapper().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    @FunctionalInterface interface Frames { Map<String,Object> read(int index) throws Exception; }
    private StudioVisionFallback() {}

    /**
     * 分批读取时交给模型的话（提示词库 stage-vision-batch，docs/studio-prompt-architecture.md §8 #10–#11）：逐张记录的要求、
     * 每批前面的说明、汇总时的说明。帧编号和时间标签（F1，原片时间 x 秒）是证据格式，仍由这里写。
     */
    record Texts(String observe, String batch, String merge) {
        /** 环节被停用时返回 null：只有真的走到分批读取才报「提示词未配置」，平时的拉片、复刻不受影响。 */
        static Texts of(com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler assembler, Map<String,Integer> frozen) {
            if (frozen == null && assembler.library().find("stage-vision-batch").filter(e -> !e.withdrawn()).isEmpty()) return null;
            var reading = assembler.assemble(com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.Call.of("stage-vision-batch", Map.of("merge", false), frozen, null));
            var merging = assembler.assemble(com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.Call.of("stage-vision-batch", Map.of("merge", true), frozen, null));
            return new Texts(reading.system(), reading.user(), merging.user());
        }
    }

    static String invoke(StudioFilmStudy.Chat chat, String system, List<Map<String,Object>> parts,
                         int tokens, boolean json, Texts texts, List<Integer> indices, com.fasterxml.jackson.databind.JsonNode source,
                         Frames frames, ObjectNode study, StudioFilmStudy.Checkpoint checkpoint) throws Exception {
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(JSON.writeValueAsBytes(
                Map.of("context",chat.context(),"system",system,"parts",parts,"indices",indices,"json",json))));
        var states = study.path("_visionFallback");
        ObjectNode state = states.path(hash).isObject() ? (ObjectNode) states.path(hash) : null;
        if (state == null) {
            try { return chat.invoke(system,parts,tokens,json); }
            catch (AiChatHttpException error) {
                if (!error.isVisualMemoryRejection() || indices.isEmpty()
                        || parts.stream().noneMatch(part->"image_url".equals(part.get("type")))) throw error;
                // The normal request was explicitly rejected, not accepted/unknown. Do not change model or pixels.
                state = study.withObject("/_visionFallback").putObject(hash);
                state.put("reason","visual-memory");state.putArray("batches");
                LoggerFactory.getLogger(StudioVisionFallback.class).warn(
                        "[studio] visual-memory fallback request={} frames={}",hash,indices.size());
                save(checkpoint,study);
            }
        }
        if (state.hasNonNull("result")) return state.path("result").asText();
        if (texts == null) throw new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                "提示词库缺少「stage-vision-batch」：请在后台「提示词与技能」里启用或补齐后重试");
        ArrayNode batches = (ArrayNode) state.path("batches");
        for (int from = batches.size()*2; from < indices.size(); from += 2) {
            int allowed = Math.min(320,chat.remainingOutputTokens()-128);
            if (allowed < 64) throw budgetExceeded();
            var selected = indices.subList(from,Math.min(from+2,indices.size()));
            List<Map<String,Object>> batch = new ArrayList<>();
            batch.add(Map.of("type","text","text",texts.batch()));
            for (int index : selected) {
                batch.add(Map.of("type","text","text","F"+(index+1)+"，原片时间 "+source.path("frameTimes").path(index)+" 秒"));
                batch.add(frames.read(index));
            }
            String answer = chat.observe(texts.observe(),batch,allowed);
            var parsed = JSON.readTree(StudioFilmStudy.stripFence(answer)).path("frames");
            if (!parsed.isArray() || parsed.size()!=selected.size()) throw badOutput();
            ArrayNode facts = JSON.createArrayNode();
            for (int j=0;j<selected.size();j++) {
                var entry=parsed.get(j);int index=selected.get(j);
                if (!entry.path("visible").isTextual() || entry.path("visible").asText().isBlank()
                        || entry.path("visible").asText().length()>2000) throw badOutput();
                // Number/time belong to engineering; models often restart numbering at one per batch.
                facts.addObject().put("frame",index+1).set("timeSec",source.path("frameTimes").path(index));
                ObjectNode fact=(ObjectNode)facts.get(j);
                fact.put("visible",entry.path("visible").asText()).put("uncertainty",entry.path("uncertainty").asText(""));
            }
            batches.add(facts);save(checkpoint,study);
        }
        List<Map<String,Object>> synthesis = new ArrayList<>();
        for (var part : parts) if ("text".equals(part.get("type"))) synthesis.add(part);
        synthesis.add(Map.of("type","text","text",texts.merge()+"\n"+batches));
        int allowed = Math.min(tokens,chat.remainingOutputTokens());
        if (allowed < 64) throw budgetExceeded();
        // Fresh text-only request: previous images are never carried forward in chat history.
        String answer = chat.invoke(system,synthesis,allowed,json);
        state.put("result",answer);save(checkpoint,study);return answer;
    }

    static Map<String,Object> nativeFrame(FileStorageService storage,com.fasterxml.jackson.databind.JsonNode source,int index) throws Exception {
        Path image=Files.createTempFile("studio-vision-native-",".jpg");
        try {
            // Seek to the original source clock, not the proxy's pixels. Tiny epsilon avoids rounding past a frame.
            double at=Math.max(0,source.path("frameTimes").path(index).asDouble()-0.000001);
            var process=StudioHypitMedia.configureMediaRuntime(new ProcessBuilder("ffmpeg","-v","error","-nostdin","-y",
                    "-ss",String.format(Locale.ROOT,"%.6f",at),"-i",storage.openForRead(source.path("storageKey").asText()).toString(),
                    "-frames:v","1","-threads","2","-q:v","3",image.toString()))
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start();
            try {
                if (!process.waitFor(30,TimeUnit.SECONDS) || process.exitValue()!=0) throw new IllegalStateException("Native frame decode failed");
            } finally { if(process.isAlive())process.destroyForcibly(); }
            return StudioVisualContext.image(Files.readAllBytes(image),Integer.MAX_VALUE);
        } finally { Files.deleteIfExists(image); }
    }
    private static void save(StudioFilmStudy.Checkpoint checkpoint,ObjectNode study) {
        int total=study.path("segments").size();
        long done=java.util.stream.StreamSupport.stream(study.path("segments").spliterator(),false)
                .filter(segment->"done".equals(segment.path("status").asText())).count();
        int pct=total==0?28:35+(int)(done*60/total);
        if (!checkpoint.save(pct,"film.vision.batch",study))
            throw BusinessException.badRequest("IP_RUN_CANCELLED","已取消");
    }
    /** Once the parent has materialized the response, don't duplicate large Markdown in checkpoints. */
    static void discardCompleted(ObjectNode study) {
        if (!(study.get("_visionFallback") instanceof ObjectNode states)) return;
        List<String> completed=new ArrayList<>();
        states.fields().forEachRemaining(entry->{if(entry.getValue().hasNonNull("result"))completed.add(entry.getKey());});
        completed.forEach(states::remove);if(states.isEmpty())study.remove("_visionFallback");
    }
    private static BusinessException budgetExceeded() { return BusinessException.badRequest("AI_USAGE_LIMIT","分批读取所需Token超出本次预算，请减少素材或调整后台预算"); }
    private static BusinessException badOutput() { return BusinessException.badRequest("AI_BAD_OUTPUT","分批画面记录不完整，请核对模型输出"); }
}
