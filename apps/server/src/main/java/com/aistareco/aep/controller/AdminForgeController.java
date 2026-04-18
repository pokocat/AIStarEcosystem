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
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/appearance-forge")
public class AdminForgeController {

    private final ForgeTemplateRepository templateRepo;
    private final ForgeResultRepository resultRepo;

    public AdminForgeController(ForgeTemplateRepository templateRepo,
                                 ForgeResultRepository resultRepo) {
        this.templateRepo = templateRepo;
        this.resultRepo = resultRepo;
    }

    @GetMapping("/options")
    public ApiResponse<ForgeOptionsDto> options() {
        List<ForgeTemplateDto> templates = templateRepo.findAll().stream()
                .map(ForgeTemplateDto::from).toList();
        // Return templates with empty option lists as placeholder
        ForgeOptionsDto opts = new ForgeOptionsDto(
                templates,
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
        return ApiResponse.of(opts);
    }

    @GetMapping("/history")
    public ApiResponse<List<ForgeResultDto>> history(@RequestParam String artistId) {
        List<ForgeResultDto> list = resultRepo.findByArtistIdOrderByCreatedAtDesc(artistId)
                .stream().map(ForgeResultDto::from).toList();
        return ApiResponse.of(list);
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
                .locked(List.of())
                .build();
        resultRepo.save(result);
        return ApiResponse.of(ForgeResultDto.from(result));
    }

    @PostMapping("/blueprint")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ForgeResultDto> saveBlueprint(@RequestBody Map<String, Object> body) {
        ForgeResult result = ForgeResult.builder()
                .id(UUID.randomUUID().toString())
                .artistId((String) body.get("artistId"))
                .image((String) body.get("image"))
                .prompt((String) body.get("prompt"))
                .mode(parseMode((String) body.get("mode")))
                .createdAt(Instant.now())
                .locked(castStringList(body.get("locked")))
                .build();
        resultRepo.save(result);
        return ApiResponse.of(ForgeResultDto.from(result));
    }

    private ForgeResult.ForgeMode parseMode(String raw) {
        if (raw == null || raw.isBlank()) return ForgeResult.ForgeMode.PROMPT_ONLY;
        return ForgeResult.ForgeMode.valueOf(raw.trim().toUpperCase(java.util.Locale.ROOT));
    }

    @SuppressWarnings("unchecked")
    private List<String> castStringList(Object obj) {
        if (obj instanceof List<?> list) {
            return list.stream().map(Object::toString).toList();
        }
        return List.of();
    }
}
