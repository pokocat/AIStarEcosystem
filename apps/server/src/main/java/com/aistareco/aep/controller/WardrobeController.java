package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ClothingItemDto;
import com.aistareco.aep.dto.SavedOutfitDto;
import com.aistareco.aep.model.SavedOutfit;
import com.aistareco.aep.model.UserInventory;
import com.aistareco.aep.repository.SavedOutfitRepository;
import com.aistareco.aep.service.StoreService;
import com.aistareco.common.ApiResponse;
import com.aistareco.repository.WardrobeItemRepository;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 用户侧衣橱：/api/wardrobe/*。
 * items 为全局服装目录（只读），outfits 为当前用户的 CRUD。
 */
@RestController
@RequestMapping("/api/wardrobe")
public class WardrobeController {

    private final WardrobeItemRepository itemRepo;
    private final SavedOutfitRepository outfitRepo;
    private final StoreService storeService;

    public WardrobeController(WardrobeItemRepository itemRepo,
                              SavedOutfitRepository outfitRepo,
                              StoreService storeService) {
        this.itemRepo = itemRepo;
        this.outfitRepo = outfitRepo;
        this.storeService = storeService;
    }

    @GetMapping("/items")
    public ApiResponse<List<ClothingItemDto>> items(Principal principal) {
        String userId = principal != null ? principal.getName() : null;
        return ApiResponse.of(itemRepo.findAll(Sort.by("id").ascending())
                .stream()
                .map(w -> ClothingItemDto.from(w,
                        userId != null && storeService.isOwned(userId, UserInventory.ItemType.WARDROBE, w.getId())))
                .toList());
    }

    @GetMapping("/outfits")
    public ApiResponse<List<SavedOutfitDto>> listOutfits(Principal principal) {
        return ApiResponse.of(outfitRepo.findByUserIdOrderByCreatedAtDesc(principal.getName())
                .stream().map(SavedOutfitDto::from).toList());
    }

    @PostMapping("/outfits")
    @ResponseStatus(HttpStatus.CREATED)
    @SuppressWarnings("unchecked")
    public ApiResponse<SavedOutfitDto> saveOutfit(Principal principal,
                                                   @RequestBody Map<String, Object> body) {
        String name = (String) body.getOrDefault("name", "未命名搭配");
        Object rawSlots = body.get("slots");
        Map<String, Object> slots = rawSlots instanceof Map<?, ?> m
                ? (Map<String, Object>) m : Map.of();
        SavedOutfit outfit = SavedOutfit.builder()
                .id(UUID.randomUUID().toString())
                .userId(principal.getName())
                .name(name)
                .slotsJson(new java.util.LinkedHashMap<>(slots))
                .createdAt(Instant.now())
                .build();
        outfitRepo.save(outfit);
        return ApiResponse.of(SavedOutfitDto.from(outfit));
    }

    @DeleteMapping("/outfits/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteOutfit(Principal principal, @PathVariable String id) {
        SavedOutfit o = outfitRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "搭配不存在"));
        if (!principal.getName().equals(o.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权删除该搭配");
        }
        outfitRepo.delete(o);
    }
}
