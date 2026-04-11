package com.aistareco.controller;

import com.aistareco.common.ApiResponse;
import com.aistareco.dto.NftCollectionSummaryDto;
import com.aistareco.model.NftCollection;
import com.aistareco.repository.NftCollectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/nft")
@RequiredArgsConstructor
public class NftController {

    private final NftCollectionRepository nftRepo;

    /** GET /api/nft/collections */
    @GetMapping("/collections")
    public ApiResponse<Map<String, Object>> collections() {
        List<NftCollectionSummaryDto> list = nftRepo.findAll().stream()
                .map(n -> new NftCollectionSummaryDto(
                        n.getId(), n.getName(), n.getCoverUrl(),
                        n.getPriceLabel(), n.getRemaining(), n.getRarity(), n.getTrackId()))
                .toList();
        return ApiResponse.of(Map.of("collections", list));
    }

    /** POST /api/nft/mint */
    @PostMapping("/mint")
    public ApiResponse<Map<String, Object>> mint(@RequestBody Map<String, Object> request) {
        String trackId  = (String) request.getOrDefault("trackId", "");
        String name     = (String) request.getOrDefault("collectionName", "New Collection");
        Object supplyObj = request.get("supply");
        int supply = supplyObj instanceof Number n ? n.intValue() : 100;
        Object priceObj = request.get("priceEth");
        double priceEth = priceObj instanceof Number n ? n.doubleValue() : 0.05;

        NftCollection nft = NftCollection.builder()
                .id("nft-" + UUID.randomUUID().toString().substring(0, 8))
                .name(name)
                .coverUrl("https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400")
                .priceLabel(String.format("¥ %.1f", priceEth * 20000))
                .remaining(supply)
                .rarity((String) request.getOrDefault("rarity", "common"))
                .trackId(trackId)
                .build();
        nftRepo.save(nft);

        String contractAddress = "0x" + UUID.randomUUID().toString().replace("-", "").substring(0, 40);
        String tokenId = "token-" + System.currentTimeMillis();
        return ApiResponse.of(Map.of("success", true, "contractAddress", contractAddress, "tokenId", tokenId));
    }
}
