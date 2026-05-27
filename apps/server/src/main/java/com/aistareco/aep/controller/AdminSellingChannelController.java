package com.aistareco.aep.controller;

import com.aistareco.aep.dto.SellingChannelDto;
import com.aistareco.aep.service.SellingChannelService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * v0.36：销售渠道 CRUD（/api/admin/selling-channels）。
 * 由 AepSecurityConfig 强制管理员角色（SUPER_ADMIN / OPERATOR）。
 */
@RestController
@RequestMapping("/api/admin/selling-channels")
public class AdminSellingChannelController {

    private final SellingChannelService service;

    public AdminSellingChannelController(SellingChannelService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<SellingChannelDto>> list() {
        return ApiResponse.of(service.listAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<SellingChannelDto> get(@PathVariable String id) {
        return ApiResponse.of(service.getById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SellingChannelDto> create(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(service.create(body));
    }

    @PutMapping("/{id}")
    public ApiResponse<SellingChannelDto> update(@PathVariable String id,
                                                  @RequestBody Map<String, Object> body) {
        return ApiResponse.of(service.update(id, body));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }
}
