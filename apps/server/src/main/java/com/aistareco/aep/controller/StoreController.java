package com.aistareco.aep.controller;

import com.aistareco.aep.dto.StoreItemDto;
import com.aistareco.aep.dto.UserInventoryDto;
import com.aistareco.aep.model.UserInventory;
import com.aistareco.aep.service.StoreService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Locale;

/**
 * 用户侧商店与库存：/api/store/* 与 /api/me/inventory。
 */
@RestController
public class StoreController {

    private final StoreService storeService;

    public StoreController(StoreService storeService) {
        this.storeService = storeService;
    }

    @GetMapping("/api/store/catalog")
    public ApiResponse<List<StoreItemDto>> catalog(Principal principal,
                                                   @RequestParam(required = false) String type) {
        String userId = principal != null ? principal.getName() : null;
        if (type == null || type.isBlank()) {
            return ApiResponse.of(storeService.catalogAll(userId));
        }
        return ApiResponse.of(storeService.catalog(userId, parseType(type)));
    }

    @PostMapping("/api/store/items/{type}/{id}/redeem")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserInventoryDto> redeem(Principal principal,
                                                @PathVariable String type,
                                                @PathVariable String id) {
        return ApiResponse.of(storeService.redeem(principal.getName(), parseType(type), id));
    }

    @GetMapping("/api/me/inventory")
    public ApiResponse<List<UserInventoryDto>> inventory(Principal principal,
                                                          @RequestParam(required = false) String type) {
        UserInventory.ItemType t = (type == null || type.isBlank()) ? null : parseType(type);
        return ApiResponse.of(storeService.listInventory(principal.getName(), t));
    }

    private UserInventory.ItemType parseType(String raw) {
        try {
            return UserInventory.ItemType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "未知商品品类: " + raw);
        }
    }
}
