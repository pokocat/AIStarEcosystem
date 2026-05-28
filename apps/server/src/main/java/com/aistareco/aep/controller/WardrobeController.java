package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ClothingItemDto;
import com.aistareco.aep.dto.ForgeResultDto;
import com.aistareco.aep.dto.SavedOutfitDto;
import com.aistareco.aep.model.ForgeResult;
import com.aistareco.aep.model.SavedOutfit;
import com.aistareco.aep.model.UserInventory;
import com.aistareco.aep.repository.SavedOutfitRepository;
import com.aistareco.aep.service.StoreService;
import com.aistareco.common.ApiResponse;
import com.aistareco.model.WardrobeItem;
import com.aistareco.repository.WardrobeItemRepository;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
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

    /**
     * 轻量锻造：把当前装备的服饰融合成一张草稿形象图（POST /wardrobe/generate-look）。
     * body: {@code { artistId, equipped: { slot: itemId, ... }, costCredits }}。
     * 返回 {@link ForgeResultDto}（status=draft 语义：不落库，入库交给 /appearance-forge/save）。
     *
     * 当前为占位实现：选稀有度最高的已装备单品图作为 hero 主图，prompt 拼接单品名。
     * 接入真实 AI 形象生成后，替换为生成管线（参照 ForgeController）。costCredits
     * 的真实扣费在保存阶段经 CreditService 走 LedgerEntry，本生成阶段不扣。
     */
    @PostMapping("/generate-look")
    @SuppressWarnings("unchecked")
    public ApiResponse<ForgeResultDto> generateLook(Principal principal,
                                                     @RequestBody Map<String, Object> body) {
        String artistId = body.get("artistId") == null ? null : body.get("artistId").toString();
        if (artistId == null || artistId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "artistId 必填");
        }

        Object rawEquipped = body.get("equipped");
        List<String> equippedIds = new ArrayList<>();
        if (rawEquipped instanceof Map<?, ?> m) {
            for (Object v : m.values()) {
                if (v != null && !v.toString().isBlank()) equippedIds.add(v.toString());
            }
        }

        List<WardrobeItem> equippedItems = equippedIds.isEmpty()
                ? List.of()
                : itemRepo.findAllById(equippedIds);

        WardrobeItem hero = equippedItems.stream()
                .max(Comparator.comparingInt(it -> rarityRank(it.getRarity())))
                .orElse(null);

        String heroImage = hero != null ? hero.getImageUrl() : null;
        if (heroImage == null) {
            // 没有装备 / 装备无图：回退到目录第一件的图，避免空主图。
            heroImage = itemRepo.findAll(Sort.by("id").ascending()).stream()
                    .map(WardrobeItem::getImageUrl)
                    .filter(s -> s != null && !s.isBlank())
                    .findFirst()
                    .orElse("");
        }

        String prompt = equippedItems.isEmpty()
                ? "默认造型"
                : equippedItems.stream()
                        .map(WardrobeItem::getNameZh)
                        .filter(n -> n != null && !n.isBlank())
                        .reduce((a, b) -> a + " + " + b)
                        .orElse("造型融合");

        ForgeResult result = ForgeResult.builder()
                .id("look-" + UUID.randomUUID().toString().substring(0, 8))
                .artistId(artistId)
                .image(heroImage)
                .prompt(prompt)
                .mode(ForgeResult.ForgeMode.TEMPLATE_PHOTO)
                .createdAt(Instant.now())
                .locked(List.of())
                .build();
        return ApiResponse.of(ForgeResultDto.from(result));
    }

    private static int rarityRank(String rarity) {
        if (rarity == null) return 0;
        return switch (rarity.toLowerCase()) {
            case "legendary" -> 3;
            case "epic" -> 2;
            case "rare" -> 1;
            default -> 0;
        };
    }
}
