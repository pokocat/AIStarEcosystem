package com.aistareco.aep.controller;

import com.aistareco.aep.dto.DigitalIpDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.service.DigitalIpService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/digital-ips")
public class AdminDigitalIpController {

    private final DigitalIpService service;

    public AdminDigitalIpController(DigitalIpService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageEnvelope<DigitalIpDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String ownerUserId,
            @RequestParam(required = false) String studioId,
            @RequestParam(required = false) String kind) {

        DigitalIp.DigitalIpKind kindEnum = parseEnum(kind, DigitalIp.DigitalIpKind.class, "不支持的类型筛选值");
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(service.list(ownerUserId, studioId, kindEnum, pageable)));
    }

    @GetMapping("/{id}")
    public ApiResponse<DigitalIpDto> getById(@PathVariable String id) {
        return ApiResponse.of(service.findById(id));
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
