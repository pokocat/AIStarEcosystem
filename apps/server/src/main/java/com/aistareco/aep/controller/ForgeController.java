package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.ForgeBlueprint;
import com.aistareco.aep.model.ForgeResult;
import com.aistareco.aep.repository.ForgeBlueprintRepository;
import com.aistareco.aep.repository.ForgeResultRepository;
import com.aistareco.aep.repository.ForgeTemplateRepository;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.CollectionType;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 用户侧 AI 形象锻造炉：/api/appearance-forge/*。
 * options / history 为只读，generate / blueprint 会写入当前结果表。
 * 管理端口径见 {@link AdminForgeController}。
 */
@RestController
@RequestMapping("/api/appearance-forge")
public class ForgeController {

    /**
     * 未接入 AI 之前使用的 demo 视频池。保存接口从中随机挑一个与 ForgeResult 关联。
     * 文件由前端 {@code apps/web/public/videos/*.mp4} 直接托管；后端仅记录相对 URL。
     * 接入 AI 后改为：本 pool 只作为测试开关，真实路径由生成管线写入对象存储并回填 videoUrl。
     */
    private static final List<String> DEMO_VIDEO_POOL = List.of(
            "/videos/showreel-01.mp4",
            "/videos/showreel-02.mp4"
    );

    private final ForgeTemplateRepository templateRepo;
    private final ForgeResultRepository resultRepo;
    private final ForgeBlueprintRepository blueprintRepo;
    private final PlatformConfigService configService;
    private final ObjectMapper objectMapper;

    public ForgeController(ForgeTemplateRepository templateRepo,
                           ForgeResultRepository resultRepo,
                           ForgeBlueprintRepository blueprintRepo,
                           PlatformConfigService configService,
                           ObjectMapper objectMapper) {
        this.templateRepo = templateRepo;
        this.resultRepo = resultRepo;
        this.blueprintRepo = blueprintRepo;
        this.configService = configService;
        this.objectMapper = objectMapper;
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
     * 当前为 fake 实现：从 {@link #DEMO_VIDEO_POOL} 中随机挑一个 URL 写入 videoUrl；
     * 接入真实 AI 视频生成后，此处应触发生成任务并在落盘后回写 videoUrl。
     *
     * 幂等策略：若该 result 已有 videoUrl，则保持不变直接返回（避免反复保存换视频）。
     * 前端需要重新抽卡时显式传 {@code "reassign": true} 即可强制替换。
     */
    @PostMapping("/save")
    @SuppressWarnings("unchecked")
    public ApiResponse<ForgeResultDto> saveResult(@RequestBody Map<String, Object> body) {
        String resultId = (String) body.get("resultId");
        if (resultId == null || resultId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resultId 必填");
        }
        ForgeResult result = resultRepo.findById(resultId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "锻造结果不存在"));

        boolean reassign = Boolean.TRUE.equals(body.get("reassign"));
        if (result.getVideoUrl() == null || result.getVideoUrl().isBlank() || reassign) {
            int idx = ThreadLocalRandom.current().nextInt(DEMO_VIDEO_POOL.size());
            result.setVideoUrl(DEMO_VIDEO_POOL.get(idx));
            resultRepo.save(result);
        }
        return ApiResponse.of(ForgeResultDto.from(result));
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
}
