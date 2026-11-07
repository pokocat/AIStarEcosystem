package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.service.StudioCaptionAligner.Segment;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.ai.ModelCallCtx;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 语音识别（2026-11-07）：后台给「语音识别」用途绑定的端点，走 OpenAI 兼容的 {@code POST {base}/audio/transcriptions}。
 * 失败或没配置都返回 empty，由调用方决定怎么说（§8.0：不编字幕内容）；上游的原话由 {@link UpstreamModelHttp} 记日志（§8.0.1 ①）。
 */
@Component
public class StudioTranscriber {
    private static final Logger log = LoggerFactory.getLogger(StudioTranscriber.class);
    /** 16 kHz 单声道 WAV 约 1.9 MB/分钟，成片最长 10 分钟。接口常见上限 25 MiB。 */
    private static final long MAX_BYTES = 25L * 1024 * 1024;
    /** 这个概率以上按没人说话处理（Whisper 在近静音处会编句子）。 */
    private static final double NO_SPEECH = 0.6;

    private final AiModelInvocationService models;
    private final UpstreamModelHttp upstream;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER).build();

    public StudioTranscriber(AiModelInvocationService models, UpstreamModelHttp upstream, ObjectMapper mapper) {
        this.models = models;
        this.upstream = upstream;
        this.mapper = mapper;
    }

    /**
     * @param wav    16 kHz 单声道 WAV
     * @param prompt 给模型的提示（已知台词或语言说明），可空
     * @return 识别结果；没配置或失败时 empty。空列表表示确实没听到人声。
     */
    public Optional<List<Segment>> transcribe(Path wav, String prompt, String owner, String refId) {
        Optional<AiModelEndpoint> found = models.resolveEndpoint(AiModelPurpose.DAP_TRANSCRIBE);
        if (found.isEmpty()) {
            log.info("[studio-caption] 语音识别未绑定 ref={}", refId);
            return Optional.empty();
        }
        AiModelEndpoint endpoint = found.get();
        String requestId = "caption-" + UUID.randomUUID();
        try {
            long size = Files.size(wav);
            if (size > MAX_BYTES) {
                log.warn("[studio-caption] 音频太大，跳过识别 ref={} bytes={}", refId, size);
                return Optional.empty();
            }
            String boundary = "----studio" + UUID.randomUUID().toString().replace("-", "");
            byte[] body = multipart(boundary, wav, endpoint.getModel(), prompt);
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(endpoint.getBaseUrl().replaceAll("/$", "") + "/audio/transcriptions"))
                    .timeout(Duration.ofMinutes(5)).header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body));
            String key = endpoint.getUpstreamApiKeyEncrypted();
            if (key != null && !key.isBlank()) builder.header("Authorization", "Bearer " + AepCryptoUtil.decrypt(key));
            var ctx = ModelCallCtx.builder(AiModelPurpose.DAP_TRANSCRIBE).endpoint(endpoint.getId(), endpoint.getName()).model(endpoint.getModel())
                    .requestId(requestId).ownerUserId(owner).appCode("aiavatar").client(http)
                    .requestBodyJson("{\"model\":\"" + endpoint.getModel() + "\",\"file\":\"audio.wav\",\"bytes\":" + size + "}")
                    .recordFailureUsage(true).maxAttempts(1).build();
            var response = upstream.sendJson(builder.build(), ctx);
            if (response.statusCode() / 100 != 2) return Optional.empty();
            try {
                return Optional.of(parse(mapper.readTree(response.body())));
            } catch (Exception e) {
                upstream.recordBadOutput(ctx, response.body(), "STUDIO_CAPTION_BAD_OUTPUT");
                log.warn("[studio-caption] 识别结果读不出来 ref={}: {}", refId, e.toString());
                return Optional.empty();
            }
        } catch (Exception e) {
            log.warn("[studio-caption] 语音识别失败 ref={} endpoint={}: {}", refId, endpoint.getId(), e.toString());
            return Optional.empty();
        }
    }

    /** OpenAI verbose_json：有 segments 用 segments，只有 text 没有时间就读不了（字幕必须有时间）。 */
    static List<Segment> parse(JsonNode result) {
        List<Segment> out = new ArrayList<>();
        JsonNode segments = result.path("segments");
        if (!segments.isArray()) {
            if (result.path("text").asText("").isBlank()) return out;
            throw new IllegalArgumentException("识别结果没有时间信息");
        }
        for (JsonNode s : segments) {
            if (s.path("no_speech_prob").asDouble(0) > NO_SPEECH) continue;
            String text = s.path("text").asText("").strip();
            double start = s.path("start").asDouble(-1), end = s.path("end").asDouble(-1);
            if (text.isEmpty() || start < 0 || end <= start) continue;
            List<Segment> words = new ArrayList<>();
            for (JsonNode w : s.path("words")) {
                String word = w.path("word").asText("").strip();
                double from = w.path("start").asDouble(-1), to = w.path("end").asDouble(-1);
                if (!word.isEmpty() && from >= 0 && to >= from) words.add(new Segment(from, to, word));
            }
            out.add(new Segment(start, end, text, words.isEmpty() ? null : words));
        }
        return out;
    }

    private static byte[] multipart(String boundary, Path wav, String model, String prompt) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream((int) Files.size(wav) + 1024);
        field(out, boundary, "model", model == null ? "" : model);
        field(out, boundary, "language", "zh");
        field(out, boundary, "response_format", "verbose_json");
        field(out, boundary, "timestamp_granularities[]", "segment");
        field(out, boundary, "timestamp_granularities[]", "word");
        if (prompt != null && !prompt.isBlank()) field(out, boundary, "prompt", prompt);
        out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\nContent-Type: audio/wav\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        Files.copy(wav, out);
        out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private static void field(ByteArrayOutputStream out, String boundary, String name, String value) throws Exception {
        out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n").getBytes(StandardCharsets.UTF_8));
    }
}
