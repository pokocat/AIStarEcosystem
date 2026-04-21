package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.ForgeBlueprint;
import com.aistareco.aep.model.ForgeResult;
import com.aistareco.aep.repository.ForgeBlueprintRepository;
import com.aistareco.aep.repository.ForgeResultRepository;
import com.aistareco.aep.repository.ForgeTemplateRepository;
import com.aistareco.aep.service.ForgeCozeService;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.CollectionType;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.Principal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 用户侧 AI 形象锻造炉：/api/appearance-forge/*。
 * options / history 为只读，generate / blueprint 会写入当前结果表。
 * 管理端口径见 {@link AdminForgeController}。
 */
@RestController
@RequestMapping("/api/appearance-forge")
public class ForgeController {

    private static final Logger log = LoggerFactory.getLogger(ForgeController.class);

    /**
     * 未接入 AI 之前使用的 demo 视频池。保存接口从中随机挑一个与 ForgeResult 关联。
     * 文件上传到服务器共享静态目录（当前默认经 Nginx 暴露为 {@code /static/videos/*}）；
     * 后端仅记录其公网相对 URL。接入 AI 后改为：本 pool 只作为测试开关，
     * 真实路径由生成管线写入对象存储并回填 videoUrl。
     */
    private static final List<String> DEMO_VIDEO_FILENAMES = List.of(
            "showreel-01.mp4",
            "showreel-02.mp4",
            "showreel-03.mp4",
            "showreel-04.mp4",
            "showreel-05.mp4"
    );

    private final ForgeTemplateRepository templateRepo;
    private final ForgeResultRepository resultRepo;
    private final ForgeBlueprintRepository blueprintRepo;
    private final PlatformConfigService configService;
    private final ForgeCozeService forgeCozeService;
    private final ObjectMapper objectMapper;
    private final String forgeVideoBaseUrl;

    public ForgeController(ForgeTemplateRepository templateRepo,
                           ForgeResultRepository resultRepo,
                           ForgeBlueprintRepository blueprintRepo,
                           PlatformConfigService configService,
                           ForgeCozeService forgeCozeService,
                           ObjectMapper objectMapper,
                           @Value("${aep.assets.video-base-url:/static/videos}") String forgeVideoBaseUrl) {
        this.templateRepo = templateRepo;
        this.resultRepo = resultRepo;
        this.blueprintRepo = blueprintRepo;
        this.configService = configService;
        this.forgeCozeService = forgeCozeService;
        this.objectMapper = objectMapper;
        this.forgeVideoBaseUrl = trimTrailingSlash(forgeVideoBaseUrl);
    }

    @GetMapping("/options")
    public ApiResponse<ForgeOptionsDto> options() {
        List<ForgeTemplateDto> templates = templateRepo.findAll().stream()
                .map(ForgeTemplateDto::from).toList();
        ForgeOptionsDto opts = new ForgeOptionsDto(
                templates,
                readList("forge.hairStyles", LabeledOptionDto.class),
                readList("forge.eyeColors", LabeledOptionDto.class),
                readList("forge.styleTags", LabeledOptionDto.class),
                readList("forge.faceSliders", FaceSliderDto.class),
                readList("forge.colorSchemes", ColorSchemeDto.class),
                readList("forge.promptSuggestions", String.class)
        );
        return ApiResponse.of(opts);
    }

    /**
     * 从 platform_configs 读取指定 key 的 JSON 数组并反序列化为 {@code List<T>}。
     * 读取失败（未 seed / JSON 不合法 / 类型不匹配）时返回空列表。
     */
    private <T> List<T> readList(String key, Class<T> elementType) {
        var dto = configService.findByKey(key).orElse(null);
        if (dto == null || dto.value() == null) return List.of();
        JsonNode node = dto.value();
        if (!node.isArray()) return List.of();
        CollectionType type = objectMapper.getTypeFactory()
                .constructCollectionType(List.class, elementType);
        try {
            return objectMapper.convertValue(node, type);
        } catch (Exception e) {
            return List.of();
        }
    }

    @GetMapping("/history")
    public ApiResponse<List<ForgeResultDto>> history(@RequestParam String artistId) {
        return ApiResponse.of(resultRepo.findByArtistIdOrderByCreatedAtDesc(artistId)
                .stream().map(ForgeResultDto::from).toList());
    }

    @PostMapping("/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ForgeResultDto> generate(@RequestBody Map<String, Object> body) {
        ForgeResult result = ForgeResult.builder()
                .id(UUID.randomUUID().toString())
                .artistId((String) body.get("artistId"))
                .image((String) body.get("image"))
                .prompt((String) body.get("prompt"))
                .mode(parseMode((String) body.get("mode")))
                .createdAt(Instant.now())
                .locked(castStringList(body.get("lockedFeatures")))
                .build();
        resultRepo.save(result);
        return ApiResponse.of(ForgeResultDto.from(result));
    }

    /**
     * 保存一次已完成的锻造结果到艺人形象库，并为其关联一段短视频资产。
     * 当前为 fake 实现：从共享静态资源视频池中随机挑一个 URL 写入 videoUrl；
     * 接入真实 AI 视频生成后，此处应触发生成任务并在落盘后回写 videoUrl。
     *
     * upsert 行为：前端目前直接在本地合成 ForgeResult（未先调 /generate 落库），
     * 因此 /save 同时承担「创建 + 关联视频」的职责。
     * - 若 body.resultId 对应 DB 行存在：更新它；
     * - 否则按 body 的其它字段（artistId/image/prompt/mode/locked）新建。
     *
     * 幂等策略：若该 result 已有 videoUrl，则保持不变直接返回（避免反复保存换视频）。
     * 前端需要重新抽卡时显式传 {@code "reassign": true} 即可强制替换。
     */
    @PostMapping("/save")
    @SuppressWarnings("unchecked")
    public ApiResponse<ForgeResultDto> saveResult(@RequestBody Map<String, Object> body) {
        String resultId = (String) body.get("resultId");
        String artistId = (String) body.get("artistId");

        ForgeResult result = (resultId == null || resultId.isBlank())
                ? null
                : resultRepo.findById(resultId).orElse(null);

        if (result == null) {
            if (artistId == null || artistId.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "resultId 未命中现有记录时必须提供 artistId + 基础字段用于新建");
            }
            Object createdAtRaw = body.get("createdAt");
            Instant createdAt = (createdAtRaw instanceof String s && !s.isBlank())
                    ? tryParseInstant(s)
                    : Instant.now();
            result = ForgeResult.builder()
                    .id((resultId == null || resultId.isBlank()) ? UUID.randomUUID().toString() : resultId)
                    .artistId(artistId)
                    .image((String) body.get("image"))
                    .prompt((String) body.get("prompt"))
                    .mode(parseMode((String) body.get("mode")))
                    .createdAt(createdAt)
                    .locked(castStringList(body.get("locked")))
                    .build();
        }

        boolean reassign = Boolean.TRUE.equals(body.get("reassign"));
        if (result.getVideoUrl() == null || result.getVideoUrl().isBlank() || reassign) {
            result.setVideoUrl(pickDemoVideoUrl());
        }
        resultRepo.save(result);
        return ApiResponse.of(ForgeResultDto.from(result));
    }

    private Instant tryParseInstant(String iso) {
        try { return Instant.parse(iso); } catch (Exception e) { return Instant.now(); }
    }

    @PostMapping("/blueprint")
    @ResponseStatus(HttpStatus.CREATED)
    @SuppressWarnings("unchecked")
    public ApiResponse<ForgeBlueprintDto> saveBlueprint(@RequestBody Map<String, Object> body) {
        String artistId = (String) body.get("artistId");
        String resultId = (String) body.get("resultId");
        if (artistId == null || artistId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "artistId 必填");
        }
        if (resultId == null || resultId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resultId 必填");
        }
        Map<String, Object> snapshot = body.get("snapshot") instanceof Map<?, ?> m
                ? new java.util.LinkedHashMap<>((Map<String, Object>) m)
                : new java.util.LinkedHashMap<>();
        // 若前端未单独传 snapshot，把 body 中除 artistId/resultId 外的字段全部存入快照。
        if (snapshot.isEmpty()) {
            for (Map.Entry<String, Object> e : body.entrySet()) {
                if (!"artistId".equals(e.getKey()) && !"resultId".equals(e.getKey())) {
                    snapshot.put(e.getKey(), e.getValue());
                }
            }
        }
        ForgeBlueprint bp = ForgeBlueprint.builder()
                .id(UUID.randomUUID().toString())
                .artistId(artistId)
                .resultId(resultId)
                .snapshotJson(snapshot)
                .createdAt(Instant.now())
                .build();
        blueprintRepo.save(bp);
        return ApiResponse.of(ForgeBlueprintDto.from(bp));
    }

    @GetMapping("/blueprints")
    public ApiResponse<List<ForgeBlueprintDto>> blueprints(@RequestParam String artistId) {
        return ApiResponse.of(blueprintRepo.findByArtistIdOrderByCreatedAtDesc(artistId)
                .stream().map(ForgeBlueprintDto::from).toList());
    }

    @GetMapping("/coze/status")
    public ApiResponse<ForgeProviderStatusDto> cozeStatus() {
        log.info("Forge Coze status endpoint hit");
        return ApiResponse.of(forgeCozeService.status());
    }

    @PostMapping(path = "/coze/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamCozeConversation(Principal principal,
                                             @Valid @RequestBody ForgeCozeChatRequest body) {
        String requestId = UUID.randomUUID().toString();
        log.info("Forge Coze stream request accepted: requestId={}, principal={}, artistId={}, promptLength={}",
                requestId,
                principal == null ? null : principal.getName(),
                body.artistId(),
                body.prompt() == null ? 0 : body.prompt().length());
        SseEmitter emitter = new SseEmitter(300_000L);
        emitter.onTimeout(() -> {
            log.warn("Forge Coze stream timeout: requestId={}", requestId);
            emitter.complete();
        });
        emitter.onCompletion(() -> log.info("Forge Coze stream emitter completed: requestId={}", requestId));
        emitter.onError(ex -> log.error("Forge Coze stream emitter error: requestId={}, message={}",
                requestId, ex == null ? null : ex.getMessage(), ex));

        CompletableFuture.runAsync(() -> {
            try {
                forgeCozeService.streamConversation(
                        requestId,
                        principal.getName(),
                        body,
                        (eventName, data) -> sendEvent(emitter, eventName, data)
                );
                log.info("Forge Coze stream request done: requestId={}", requestId);
                sendEvent(emitter, "done", Map.of("message", "stream closed"));
                emitter.complete();
            } catch (Exception ex) {
                log.error("Forge Coze stream request failed: requestId={}, message={}",
                        requestId, ex.getMessage(), ex);
                try {
                    sendEvent(emitter, "error", Map.of("message", resolveStreamError(ex)));
                } catch (Exception ignored) {
                    // ignore secondary send failure
                }
                emitter.completeWithError(ex);
            }
        });
        return emitter;
    }

    private ForgeResult.ForgeMode parseMode(String raw) {
        if (raw == null || raw.isBlank()) return ForgeResult.ForgeMode.PROMPT_ONLY;
        return ForgeResult.ForgeMode.valueOf(raw.trim().toUpperCase(Locale.ROOT));
    }

    @SuppressWarnings("unchecked")
    private List<String> castStringList(Object obj) {
        if (obj instanceof List<?> list) {
            return list.stream().map(Object::toString).toList();
        }
        return List.of();
    }

    private String pickDemoVideoUrl() {
        int idx = ThreadLocalRandom.current().nextInt(DEMO_VIDEO_FILENAMES.size());
        return forgeVideoBaseUrl + "/" + DEMO_VIDEO_FILENAMES.get(idx);
    }

    private void sendEvent(SseEmitter emitter, String eventName, Map<String, Object> data) {
        try {
            emitter.send(SseEmitter.event().name(eventName).data(new LinkedHashMap<>(data)));
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private String resolveStreamError(Throwable ex) {
        Throwable cursor = ex;
        while (cursor != null) {
            if (cursor instanceof ResponseStatusException rse) {
                return rse.getReason() == null ? "请求失败" : rse.getReason();
            }
            cursor = cursor.getCause();
        }
        String msg = ex.getMessage();
        return msg == null || msg.isBlank() ? "Coze 流式请求失败" : msg;
    }

    private String trimTrailingSlash(String value) {
        return value == null ? "/static/videos" : value.replaceAll("/+$", "");
    }
}
