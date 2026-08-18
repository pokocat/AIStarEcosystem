package com.aistareco.aep.clip.service.shiliu;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** 石榴 AI API v1 真实适配器。密钥仅从运行时配置读取，不落库、不打印。 */
@Component
public class HttpShiliuGateway implements ShiliuGateway {
    private static final Logger log = LoggerFactory.getLogger(HttpShiliuGateway.class);
    private static final ObjectMapper OM = new ObjectMapper();
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(45);

    private final ClipProperties props;
    private final FileStorageService storage;
    private final HttpClient http;

    @Autowired
    public HttpShiliuGateway(ClipProperties props, FileStorageService storage) {
        this(props, storage, HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build());
    }

    HttpShiliuGateway(ClipProperties props, FileStorageService storage, HttpClient http) {
        this.props = props;
        this.storage = storage;
        this.http = http;
    }

    @Override
    public Task previewVoice(String ownerId, String speakerRef, String text) {
        ObjectNode body = OM.createObjectNode();
        body.put("speakerId", numericRef(speakerRef, "speakerId"));
        body.put("text", requiredText(text, 10_000, "试听文案"));
        JsonNode data = post("/speaker/tts", body);
        String audio = text(data, "audio");
        if (audio == null || audio.isBlank()) throw invalidResponse("speaker/tts missing audio");
        byte[] bytes;
        try {
            String raw = audio.startsWith("data:") ? audio.substring(audio.indexOf(',') + 1) : audio;
            bytes = Base64.getMimeDecoder().decode(raw);
        } catch (IllegalArgumentException e) {
            throw invalidResponse("speaker/tts audio is not base64");
        }
        if (bytes.length == 0 || bytes.length > 20 * 1024 * 1024) throw invalidResponse("speaker/tts audio size invalid");
        FileStorageService.StoredFile stored = storage.store(bytes, "clip/preview-voice", ownerId, "mp3", "audio/mpeg");
        int durationSec = durationSeconds(data.path("length").asLong(0), text.length());
        return new Task("tts:" + UUID.randomUUID().toString().substring(0, 12), "succeeded", durationSec,
                stored.signedUrl(), null, null, stored.key());
    }

    @Override
    public Task createVideoByText(String ownerId, String avatarRef, String speakerRef, String text) {
        ObjectNode body = OM.createObjectNode();
        body.put("avatarId", numericRef(avatarRef, "avatarId"));
        body.put("speakerId", numericRef(speakerRef, "speakerId"));
        body.put("text", requiredText(text, 10_000, "口播文案"));
        body.put("title", title("军师口播"));
        body.put("speedRatio", 1);
        body.put("addWatermark", true);
        body.put("addSubtitle", true);
        JsonNode data = post("/video/createByText", body);
        String id = id(data, "videoId");
        return new Task("video:" + id, "processing", durationSecondsNullable(data.path("length").asLong(0)), null, null);
    }

    @Override
    public Task createVideoByAudioFile(String ownerId, String avatarRef, String audioRef) {
        ObjectNode body = OM.createObjectNode();
        body.put("avatarId", numericRef(avatarRef, "avatarId"));
        body.put("audioUrl", publicMediaUrl(audioRef));
        body.put("title", title("军师口播"));
        body.put("addWatermark", true);
        JsonNode data = post("/video/createByVoiceV2", body);
        String id = id(data, "videoId");
        return new Task("video:" + id, "processing", durationFrom(data), null, null, 0);
    }

    @Override
    public Task cloneAvatar(String ownerId, String mediaRef, String speakerRef, String authorizationRef) {
        ObjectNode body = OM.createObjectNode();
        body.put("videoUrl", publicMediaUrl(mediaRef));
        // 石榴官方 OpenAPI：speakerId 是“选填，用于制作 demo”。
        // 数字人训练的主输入是视频，不得因用户没有先单独采集音频而阻断。
        if (speakerRef != null && !speakerRef.isBlank()) {
            body.put("speakerId", numericRef(speakerRef, "speakerId"));
        }
        body.put("title", title("军师数字分身"));
        // 官方契约：仅在需要授权视频校验时填写 authId；不填写默认不校验。
        if (authorizationRef != null && !authorizationRef.isBlank()) {
            body.put("authId", numericRef(authorizationRef, "authId"));
        }
        JsonNode data = post("/avatar/create", body);
        String id = id(data, "avatarId");
        return new Task("avatar:" + id, "processing", null, id, null);
    }

    @Override
    public Task cloneVoice(String ownerId, String mediaRef) {
        ObjectNode body = OM.createObjectNode();
        body.put("audioUrl", publicMediaUrl(mediaRef));
        body.put("title", title("军师本人音色"));
        body.put("model", "V2.0");
        JsonNode data = post("/speaker/create", body);
        String id = id(data, "speakerId");
        return new Task("speaker:" + id, "processing", null, id, null);
    }

    @Override
    public Task recreateVoice(String ownerId, String speakerRef, String mediaRef) {
        ObjectNode body = OM.createObjectNode();
        body.put("speakerId", numericRef(speakerRef, "speakerId"));
        body.put("audioUrl", publicMediaUrl(mediaRef));
        body.put("model", "V2.0");
        // 实测：拿已删除的 speakerId 调这里会回 code=1「该音色当前无法重新克隆」，
        // 说明 recreate 只作用于活着的对象、且走该音色自己的 4 次额度，不吃新的克隆权益。
        JsonNode data = post("/speaker/recreate", body);
        String id = id(data, "speakerId");
        return new Task("speaker:" + (id == null || id.isBlank() ? speakerRef : id), "processing", null,
                id == null || id.isBlank() ? speakerRef : id, null);
    }

    @Override
    public RecreateQuota recreateQuota(String speakerRef) {
        ObjectNode body = OM.createObjectNode();
        body.put("speakerId", numericRef(speakerRef, "speakerId"));
        try {
            JsonNode data = firstObject(post("/speaker/getRecreatedRecord", body));
            Integer used = data.hasNonNull("count") ? data.path("count").asInt()
                    : data.hasNonNull("usedCount") ? data.path("usedCount").asInt() : null;
            Integer total = data.hasNonNull("total") ? data.path("total").asInt()
                    : data.hasNonNull("limit") ? data.path("limit").asInt() : null;
            return new RecreateQuota(used, total, true);
        } catch (BusinessException e) {
            // 读不到额度不该拖垮调用方：置 null 让上层显示"未知"，而不是当成 0 次可用。
            log.warn("[clip-shiliu] 重训额度读取失败 ref={}: {}", speakerRef, e.getMessage());
            return new RecreateQuota(null, null, false);
        }
    }

    @Override
    public Task cloneAvatarByImage(String ownerId, String imageRef, String speakerRef) {
        ObjectNode body = OM.createObjectNode();
        body.put("imageUrl", publicMediaUrl(imageRef));
        if (speakerRef != null && !speakerRef.isBlank()) body.put("speakerId", numericRef(speakerRef, "speakerId"));
        body.put("title", title("军师数字分身"));
        JsonNode data = post("/avatar/createByImage", body);
        String id = id(data, "avatarId");
        return new Task("avatar:" + id, "processing", null, id, null);
    }

    @Override
    public Task createAuthorizationVideo(String ownerId, String mediaRef, String spokenText) {
        ObjectNode body = OM.createObjectNode();
        body.put("videoUrl", publicMediaUrl(mediaRef));
        body.put("text", requiredText(spokenText, 300, "授权口令"));
        JsonNode data = post("/authVideo/create", body);
        String id = data.isValueNode() ? data.asText() : id(data, "authId");
        if (id == null || id.isBlank() || !id.matches("\\d+")) throw invalidResponse("authVideo/create missing authId");
        return new Task("authorization:" + id, "succeeded", null, id, null);
    }

    @Override
    public Task query(String taskId) {
        String[] parts = splitTaskId(taskId);
        String kind = parts[0];
        String id = parts[1];
        ObjectNode body = OM.createObjectNode();
        switch (kind) {
            case "speaker" -> body.put("speakerId", numericRef(id, "speakerId"));
            case "avatar" -> body.put("avatarId", numericRef(id, "avatarId"));
            case "video" -> body.put("videoId", numericRef(id, "videoId"));
            default -> throw new BusinessException(HttpStatus.BAD_REQUEST, "CLIP_ENGINE_TASK_INVALID", "数字人任务标识无效");
        }
        JsonNode data = firstObject(post("/" + kind + "/status", body));
        String status = normalizedStatus(text(data, "status"));
        String output = "video".equals(kind) && "succeeded".equals(status) ? text(data, "videoUrl") : id;
        String error = "failed".equals(status) ? firstNonBlank(text(data, "failReason"), text(data, "error"), "上游任务失败") : null;
        return new Task(kind + ":" + id, status, durationFrom(data), output, error, progress(data, status));
    }

    @Override public void deleteAvatar(String engineRef) { delete("/avatar/delete", "avatarId", engineRef); }
    @Override public void deleteVoice(String engineRef) { delete("/speaker/delete", "speakerId", engineRef); }

    @Override
    public AssetQuota asset() {
        JsonNode data = post("/asset/get", OM.createObjectNode());
        return new AssetQuota(intValue(data, "availableAvatar"), intValue(data, "availableSpeaker"),
                longValue(data, "validPoint"), text(data, "validToTime"));
    }

    @Override public List<VendorObject> listAvatars() { return objects("/avatar/list", "avatarId"); }
    @Override public List<VendorObject> listSpeakers() { return objects("/speaker/list", "speakerId"); }

    /** {@code /avatar/list} 与 {@code /speaker/list} 形状一致：data 是对象数组，只有 id 字段名不同。 */
    private List<VendorObject> objects(String path, String idField) {
        JsonNode data = post(path, OM.createObjectNode());
        if (!data.isArray()) throw invalidResponse(path + " data is not an array");
        List<VendorObject> out = new ArrayList<>();
        for (JsonNode row : data) {
            String id = text(row, idField);
            // 上游 id 是数值型。个别脏行无法与 engine_ref 关联，跳过好过让整张运营总览 502。
            if (id == null || !id.matches("\\d{1,20}")) {
                log.warn("[clip-shiliu] skipped unusable list row path={} idField={}", path, idField);
                continue;
            }
            out.add(new VendorObject(id, text(row, "title")));
        }
        return out;
    }

    @Override public boolean mock() { return false; }

    /**
     * 删除是**幂等**的：上游回「已删除 / 不存在」时视为成功。
     *
     * 实测事故：批量删除时若某个对象上游已经没了（上一次删除部分成功后事务回滚，
     * 但上游删除不在事务里、回滚不掉），这一条会抛错并中止整批 —— 用户越删越乱，
     * 本地与上游的不一致反而扩大。「上游已经没有」本就是我们想要的终态。
     */
    private void delete(String path, String field, String ref) {
        ObjectNode body = OM.createObjectNode();
        body.put(field, numericRef(ref, field));
        try { post(path, body); }
        catch (BusinessException e) {
            String detail = (e.getInternalDetail() == null ? "" : e.getInternalDetail()) + " " + e.getMessage();
            if (detail.contains("已删除") || detail.contains("不存在") || detail.contains("未找到")) {
                log.info("[clip-shiliu] {} 上游对象已不存在，按幂等成功处理 ref={}", path, ref);
                return;
            }
            throw e;
        }
    }

    private JsonNode post(String path, JsonNode body) {
        URI base = configuredBase();
        URI uri = base.resolve(stripLeadingSlash(path));
        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(REQUEST_TIMEOUT)
                    .header("Authorization", "Bearer " + props.getShiliuToken())
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(OM.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("[clip-shiliu] http failure path={} status={}", path, response.statusCode());
                throw upstreamFailure("石榴 AI 请求失败（HTTP " + response.statusCode() + "）", "status=" + response.statusCode());
            }
            JsonNode envelope = OM.readTree(response.body());
            int code = envelope.path("code").asInt(Integer.MIN_VALUE);
            if (code != 0) {
                String message = clamp(text(envelope, "msg"), 180);
                log.warn("[clip-shiliu] upstream rejected path={} code={} msg={}", path, code, message);
                throw mappedUpstreamFailure(code, message);
            }
            JsonNode data = envelope.get("data");
            if (data == null || data.isNull()) throw invalidResponse(path + " data is null");
            return data;
        } catch (BusinessException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw upstreamFailure("石榴 AI 请求被中断，请稍后重试", e.toString());
        } catch (IOException | IllegalArgumentException e) {
            log.warn("[clip-shiliu] call failed path={} error={}", path, e.toString());
            throw upstreamFailure("石榴 AI 暂时不可用，请稍后重试", e.toString());
        }
    }

    private URI configuredBase() {
        String raw = props.getShiliuBaseUrl();
        if (raw == null || raw.isBlank()) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,
                "CLIP_ENGINE_NOT_CONFIGURED", "数字人视频引擎尚未配置");
        String normalized = raw.endsWith("/") ? raw : raw + "/";
        URI uri = URI.create(normalized);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "CLIP_ENGINE_CONFIG_INVALID", "数字人视频引擎地址配置无效");
        }
        return uri;
    }

    private String publicMediaUrl(String ref) {
        if (ref == null || ref.isBlank()) throw new BusinessException(HttpStatus.BAD_REQUEST, "CLIP_MEDIA_REQUIRED", "缺少媒体文件");
        if (ref.startsWith("https://")) return ref;
        if (ref.startsWith("http://")) throw new BusinessException(HttpStatus.BAD_REQUEST, "CLIP_MEDIA_URL_INSECURE", "媒体地址必须使用 HTTPS");
        String url = storage.signedUrl(ref);
        if (url == null || !url.startsWith("https://")) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "CLIP_MEDIA_PUBLIC_URL_NOT_CONFIGURED", "媒体公网地址尚未配置");
        }
        return url;
    }

    private static long numericRef(String ref, String field) {
        if (ref == null || !ref.matches("\\d{1,20}")) throw new BusinessException(HttpStatus.BAD_REQUEST,
                "CLIP_ENGINE_REF_INVALID", field + " 无效");
        try { return Long.parseLong(ref); }
        catch (NumberFormatException e) { throw new BusinessException(HttpStatus.BAD_REQUEST, "CLIP_ENGINE_REF_INVALID", field + " 无效"); }
    }

    private static String requiredText(String value, int max, String label) {
        String text = value == null ? "" : value.trim();
        if (text.isBlank() || text.length() > max) throw new BusinessException(HttpStatus.BAD_REQUEST,
                "CLIP_ENGINE_TEXT_INVALID", label + "不能为空且不能超过 " + max + " 字");
        return text;
    }

    private static String[] splitTaskId(String taskId) {
        if (taskId == null) return new String[]{"", ""};
        int colon = taskId.indexOf(':');
        if (colon < 1 || colon == taskId.length() - 1) return new String[]{"video", taskId};
        return new String[]{taskId.substring(0, colon), taskId.substring(colon + 1)};
    }

    private static String normalizedStatus(String raw) {
        String value = raw == null ? "" : raw.toLowerCase(Locale.ROOT);
        if (value.matches("ready|success|succeeded|completed|done")) return "succeeded";
        if (value.matches("fail|failed|failure|error|rejected")) return "failed";
        return "processing";
    }

    private static JsonNode firstObject(JsonNode data) {
        if (data != null && data.isArray()) {
            if (data.isEmpty()) throw invalidResponse("status data is empty");
            return data.get(0);
        }
        return data;
    }

    private static Integer progress(JsonNode data, String status) {
        if ("succeeded".equals(status)) return 100;
        JsonNode value = data == null ? null : data.get("progress");
        if (value == null || value.isNull()) return 0;
        try { return Math.max(0, Math.min(100, Integer.parseInt(value.asText().replace("%", "").trim()))); }
        catch (NumberFormatException e) { return 0; }
    }

    private static Integer durationFrom(JsonNode data) {
        if (data == null) return null;
        for (String field : new String[]{"duration", "length"}) {
            JsonNode value = data.get(field);
            if (value == null || value.isNull()) continue;
            try {
                double millis = Double.parseDouble(value.asText().trim());
                if (millis > 0) return (int) Math.max(1, Math.ceil(millis / 1000d));
            } catch (NumberFormatException ignore) { }
        }
        return null;
    }

    private static int durationSeconds(long upstreamLength, int textLength) {
        Integer parsed = durationSecondsNullable(upstreamLength);
        return parsed == null ? Math.max(1, Math.round(textLength / 4f)) : parsed;
    }

    private static Integer durationSecondsNullable(long upstreamLength) {
        if (upstreamLength <= 0) return null;
        return (int) Math.max(1, Math.ceil(upstreamLength / 1000d));
    }

    private static String id(JsonNode data, String field) {
        JsonNode value = data.get(field);
        String result = value == null || value.isNull() ? null : value.asText();
        if (result == null || !result.matches("\\d+")) throw invalidResponse(field + " missing");
        return result;
    }

    private static String title(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    /** 数值字段容错读取：上游偶有把数字包成字符串的写法，两种都收。读不出返回 null（不是 0）。 */
    private static Long longValue(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) return null;
        if (value.isNumber()) return value.asLong();
        try { return Long.parseLong(value.asText().trim()); }
        catch (NumberFormatException e) { return null; }
    }

    private static Integer intValue(JsonNode node, String field) {
        Long value = longValue(node, field);
        if (value == null) return null;
        return (int) Math.max(Integer.MIN_VALUE, Math.min(Integer.MAX_VALUE, value));
    }

    private static String text(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value;
        return null;
    }

    private static String stripLeadingSlash(String value) { return value.startsWith("/") ? value.substring(1) : value; }
    private static String clamp(String value, int max) { return value == null ? null : value.substring(0, Math.min(max, value.length())); }
    private static BusinessException invalidResponse(String detail) {
        return BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "CLIP_ENGINE_RESPONSE_INVALID",
                "石榴 AI 返回了无法识别的数据，请稍后重试", detail);
    }
    private static BusinessException upstreamFailure(String message, String detail) {
        return BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "CLIP_ENGINE_CALL_FAILED", message, detail);
    }

    /** 包级可见：供 HttpShiliuGatewayErrorMappingTest 直接覆盖各错误码分支。 */
    static BusinessException mappedUpstreamFailure(int code, String message) {
        String suffix = message == null || message.isBlank() ? "" : "：" + message;
        return switch (code) {
            case 1002 -> BusinessException.wrapped(HttpStatus.UNPROCESSABLE_ENTITY, "CLIP_ENGINE_INPUT_INVALID", "采集内容不符合数字人引擎要求" + suffix, "code=" + code);
            case 2001 -> BusinessException.wrapped(HttpStatus.SERVICE_UNAVAILABLE, "CLIP_ENGINE_CREDENTIAL_INVALID", "数字人服务鉴权失效，请联系运营处理", "code=" + code);
            case 2002 -> BusinessException.wrapped(HttpStatus.SERVICE_UNAVAILABLE, "CLIP_ENGINE_BALANCE_INSUFFICIENT", "数字人服务额度不足，请联系运营处理", "code=" + code);
            case 3001 -> BusinessException.wrapped(HttpStatus.UNPROCESSABLE_ENTITY, "CLIP_ENGINE_VIDEO_UNREADABLE", "视频无法读取，请重新录制后再试", "code=" + code);
            case 3002 -> BusinessException.wrapped(HttpStatus.UNPROCESSABLE_ENTITY, "CLIP_ENGINE_AUDIO_UNREADABLE", "声音文件无法读取，请重新录制后再试", "code=" + code);
            case 3003 -> BusinessException.wrapped(HttpStatus.UNPROCESSABLE_ENTITY, "CLIP_ENGINE_VOICE_REJECTED", "这段声音未通过声纹安全检查，请确认由本人录制", "code=" + code);
            case 3004 -> BusinessException.wrapped(HttpStatus.UNPROCESSABLE_ENTITY, "CLIP_ENGINE_AUDIO_TOO_SHORT", "录音太短，请完整朗读采集文案后再试", "code=" + code);
            case 3005 -> BusinessException.wrapped(HttpStatus.UNPROCESSABLE_ENTITY, "CLIP_ENGINE_SPEECH_UNCLEAR", "没有识别到清晰人声，请在安静环境重新录制", "code=" + code);
            case 3006 -> BusinessException.wrapped(HttpStatus.CONFLICT, "CLIP_ENGINE_SPEAKER_NOT_FOUND", "声音模型不存在，请重新采集声音", "code=" + code);
            case 3007 -> BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "CLIP_ENGINE_MEDIA_URL_INVALID", "数字人服务暂时无法读取采集文件，请稍后重试", "code=" + code);
            default -> byMessage(code, message, suffix);
        };
    }

    /**
     * 未列入映射表的错误码，按上游文案兜底判别。
     *
     * 石榴把 <b>code=1 当通用兜底码</b>用，真实语义只在 msg 里（实测：
     * {@code code=1 msg=账户权益不足，无法进行声音克隆}）。全丢给 502 的后果是
     * 「运营该去充值」被伪装成「我们的服务故障」——端上只会显示一句通用的服务不可用，
     * 每次都得上服务器翻日志才知道真因。
     *
     * 关键词匹配上游文案确实脆弱（供应商改文案就会失配），所以这里只做<b>降级增强</b>：
     * 匹配上就给准确错误码，匹配不上仍回原来的 502，不会比现状更差。
     * 供应商将来给出稳定的数字错误码，应当把对应分支上移到 switch 里。
     */
    private static BusinessException byMessage(int code, String message, String suffix) {
        String text = message == null ? "" : message;
        if (text.contains("权益不足") || text.contains("额度不足") || text.contains("余额不足") || text.contains("配额")) {
            // ⚠️ 这句「账户权益不足」的真实含义，2026-08-13 用两步实测厘清过，别再重新解读：
            //   1) 账户有 3 avatar / 2 speaker 时 availableAvatar、availableSpeaker 均为 0，
            //      而 validPoint 尚有 3418 —— 一度据此判断是"可保存数量占满"；
            //   2) 把 avatar 与 speaker 全部删空后重查，两个字段**仍然是 0**。
            // 结论：这两个字段是**独立购买的克隆权益数量**，既不是余额、也不是可用槽位。
            // 所以文案既不能说"去充值"（点数充了也没用），也不能说"删掉旧的"（删空了也没用），
            // 只能指向真正的动作：找运营开通克隆权益。
            return BusinessException.wrapped(HttpStatus.CONFLICT, "CLIP_ENGINE_CAPACITY_FULL",
                    "数字人克隆权益不足，请联系运营开通后再试", "code=" + code + " msg=" + text);
        }
        if (text.contains("鉴权") || text.contains("认证失败") || text.contains("token") || text.contains("密钥")) {
            return BusinessException.wrapped(HttpStatus.SERVICE_UNAVAILABLE, "CLIP_ENGINE_CREDENTIAL_INVALID",
                    "数字人服务鉴权失效，请联系运营处理", "code=" + code + " msg=" + text);
        }
        return upstreamFailure("石榴 AI 未受理任务" + suffix, "code=" + code);
    }
}
