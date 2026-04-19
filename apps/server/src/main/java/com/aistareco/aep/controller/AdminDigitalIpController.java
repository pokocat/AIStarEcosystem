package com.aistareco.aep.controller;

import com.aistareco.aep.dto.DigitalIpDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.aep.service.DigitalIpService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/digital-ips")
public class AdminDigitalIpController {

    private final DigitalIpService service;
    private final DigitalIpRepository ipRepo;
    private final StudioRepository studioRepo;

    public AdminDigitalIpController(DigitalIpService service,
                                     DigitalIpRepository ipRepo,
                                     StudioRepository studioRepo) {
        this.service = service;
        this.ipRepo = ipRepo;
        this.studioRepo = studioRepo;
    }

    @GetMapping
    public PageEnvelope<DigitalIpDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String ownerUserId,
            @RequestParam(required = false) String studioId,
            @RequestParam(required = false) String kind) {

        DigitalIp.DigitalIpKind kindEnum = parseEnum(kind, DigitalIp.DigitalIpKind.class, "不支持的类型筛选值");
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<DigitalIp> entityPage;
        if (ownerUserId != null && !ownerUserId.isBlank()) {
            entityPage = ipRepo.findByOwnerUserId(ownerUserId, pageable);
        } else if (studioId != null && !studioId.isBlank()) {
            entityPage = ipRepo.findByStudioId(studioId, pageable);
        } else if (kindEnum != null) {
            entityPage = ipRepo.findByKind(kindEnum, pageable);
        } else {
            entityPage = ipRepo.findAll(pageable);
        }

        Map<String, String> studioNames = loadStudioNames(entityPage.getContent());
        return PageEnvelope.from(entityPage.map(ip -> DigitalIpDto.from(ip, studioNames.get(ip.getStudioId()))));
    }

    @GetMapping("/{id}")
    public ApiResponse<DigitalIpDto> getById(@PathVariable String id) {
        DigitalIp ip = ipRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Digital IP not found: " + id));
        String studioName = ip.getStudioId() == null ? null :
                studioRepo.findById(ip.getStudioId()).map(Studio::getName).orElse(null);
        return ApiResponse.of(DigitalIpDto.from(ip, studioName));
    }

    private Map<String, String> loadStudioNames(java.util.Collection<DigitalIp> items) {
        Set<String> studioIds = items.stream()
                .map(DigitalIp::getStudioId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (studioIds.isEmpty()) return Map.of();
        Map<String, String> names = new HashMap<>();
        studioRepo.findAllById(studioIds).forEach(s -> names.put(s.getId(), s.getName()));
        return names;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DigitalIpDto> create(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(service.create(body, null));
    }

    @PutMapping("/{id}")
    public ApiResponse<DigitalIpDto> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(service.update(id, body));
    }

    @PatchMapping("/{id}")
    public ApiResponse<DigitalIpDto> patch(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(service.update(id, body));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }

    private <E extends Enum<E>> E parseEnum(String raw, Class<E> type, String errorMessage) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, errorMessage);
        }
    }
}
