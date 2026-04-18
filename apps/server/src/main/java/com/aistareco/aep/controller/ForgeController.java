package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.ForgeResult;
import com.aistareco.aep.repository.ForgeResultRepository;
import com.aistareco.aep.repository.ForgeTemplateRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 用户侧 AI 形象锻造炉：/api/appearance-forge/*。
 * options / history 为只读，generate / blueprint 会写入当前结果表。
 * 管理端口径见 {@link AdminForgeController}。
 */
@RestController
@RequestMapping("/api/appearance-forge")
public class ForgeController {

    private final ForgeTemplateRepository templateRepo;
    private final ForgeResultRepository resultRepo;

    public ForgeController(ForgeTemplateRepository templateRepo,
                           ForgeResultRepository resultRepo) {
        this.templateRepo = templateRepo;
        this.resultRepo = resultRepo;
    }

    @GetMapping("/options")
    public ApiResponse<ForgeOptionsDto> options() {
        List<ForgeTemplateDto> templates = templateRepo.findAll().stream()
                .map(ForgeTemplateDto::from).toList();
        ForgeOptionsDto opts = new ForgeOptionsDto(
                templates, List.of(), List.of(), List.of(), List.of()
        );
        return ApiResponse.of(opts);
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

    @PostMapping("/blueprint")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> saveBlueprint(@RequestBody Map<String, Object> body) {
        String artistId = (String) body.get("artistId");
        String resultId = (String) body.get("resultId");
        // 当前仅做幂等成功响应；蓝图快照表待 spec 最终确认后再落库。
        return ApiResponse.of(Map.of("ok", true, "artistId", artistId, "resultId", resultId));
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
