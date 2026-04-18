package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ClothingItemDto;
import com.aistareco.aep.dto.ExpressionDto;
import com.aistareco.aep.dto.GestureDto;
import com.aistareco.aep.dto.PoseDto;
import com.aistareco.aep.dto.UserInventoryDto;
import com.aistareco.aep.model.UserInventory;
import com.aistareco.aep.service.StoreService;
import com.aistareco.common.ApiResponse;
import com.aistareco.model.Expression;
import com.aistareco.model.Gesture;
import com.aistareco.model.Pose;
import com.aistareco.model.WardrobeItem;
import com.aistareco.repository.ExpressionRepository;
import com.aistareco.repository.GestureRepository;
import com.aistareco.repository.PoseRepository;
import com.aistareco.repository.WardrobeItemRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Map;

/**
 * 运营后台商品定价 / 库存管理：/api/admin/store/*。
 * 只暴露必要字段修改（priceCredits + saleStatus + previewUrl），
 * 商品本身的创建 / 删除走各品类的 legacy admin 端（后续可能独立新建）。
 */
@RestController
@RequestMapping("/api/admin/store")
public class AdminStoreController {

    private final WardrobeItemRepository wardrobeRepo;
    private final PoseRepository poseRepo;
    private final ExpressionRepository expressionRepo;
    private final GestureRepository gestureRepo;
    private final StoreService storeService;

    public AdminStoreController(WardrobeItemRepository wardrobeRepo,
                                PoseRepository poseRepo,
                                ExpressionRepository expressionRepo,
                                GestureRepository gestureRepo,
                                StoreService storeService) {
        this.wardrobeRepo = wardrobeRepo;
        this.poseRepo = poseRepo;
        this.expressionRepo = expressionRepo;
        this.gestureRepo = gestureRepo;
        this.storeService = storeService;
    }

    /**
     * 统一修改 priceCredits / saleStatus / previewUrl。
     * Body: {"priceCredits":100,"saleStatus":"PAID","previewUrl":"..."}
     * 任意字段缺失则保留原值。
     */
    @PutMapping("/items/{type}/{id}")
    public ApiResponse<Object> updatePricing(@PathVariable String type,
                                             @PathVariable String id,
                                             @RequestBody Map<String, Object> body) {
        Integer newPrice = toInt(body.get("priceCredits"));
        WardrobeItem.SaleStatus newStatus = parseStatus(body.get("saleStatus"));
        String newPreview = (String) body.get("previewUrl");

        switch (parseType(type)) {
            case WARDROBE -> {
                WardrobeItem w = wardrobeRepo.findById(id)
                        .orElseThrow(() -> notFound("服装"));
                if (newPrice != null) w.setPriceCredits(newPrice);
                if (newStatus != null) w.setSaleStatus(newStatus);
                if (newPreview != null) w.setPreviewUrl(newPreview);
                wardrobeRepo.save(w);
                return ApiResponse.of(ClothingItemDto.from(w));
            }
            case POSE -> {
                Pose p = poseRepo.findById(id).orElseThrow(() -> notFound("姿态"));
                if (newPrice != null) p.setPriceCredits(newPrice);
                if (newStatus != null) p.setSaleStatus(newStatus);
                if (newPreview != null) p.setPreviewUrl(newPreview);
                poseRepo.save(p);
                return ApiResponse.of(PoseDto.from(p));
            }
            case EXPRESSION -> {
                Expression e = expressionRepo.findById(id).orElseThrow(() -> notFound("表情"));
                if (newPrice != null) e.setPriceCredits(newPrice);
                if (newStatus != null) e.setSaleStatus(newStatus);
                if (newPreview != null) e.setPreviewUrl(newPreview);
                expressionRepo.save(e);
                return ApiResponse.of(ExpressionDto.from(e));
            }
            case GESTURE -> {
                Gesture g = gestureRepo.findById(id).orElseThrow(() -> notFound("手势"));
                if (newPrice != null) g.setPriceCredits(newPrice);
                if (newStatus != null) g.setSaleStatus(newStatus);
                if (newPreview != null) g.setPreviewUrl(newPreview);
                gestureRepo.save(g);
                return ApiResponse.of(GestureDto.from(g));
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "暂不支持的品类");
        }
    }

    /**
     * 运营赠送：直接往 user_inventory 写一条（不扣积分，不写 ledger）。
     * Body: {"userId":"u-xxx"}
     */
    @PostMapping("/items/{type}/{id}/grant")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserInventoryDto> grant(@PathVariable String type,
                                               @PathVariable String id,
                                               @RequestBody Map<String, Object> body) {
        String userId = (String) body.get("userId");
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId 必填");
        }
        return ApiResponse.of(storeService.grant(userId, parseType(type), id));
    }

    private UserInventory.ItemType parseType(String raw) {
        try {
            return UserInventory.ItemType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "未知品类: " + raw);
        }
    }

    private WardrobeItem.SaleStatus parseStatus(Object raw) {
        if (raw == null) return null;
        try {
            return WardrobeItem.SaleStatus.valueOf(raw.toString().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "未知销售状态: " + raw);
        }
    }

    private Integer toInt(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(raw.toString().trim());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "priceCredits 必须是整数");
        }
    }

    private ResponseStatusException notFound(String label) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, label + "不存在");
    }
}
