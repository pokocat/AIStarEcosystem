package com.aistareco.controller;

import com.aistareco.common.ApiResponse;
import com.aistareco.dto.MarketplaceListingDto;
import com.aistareco.model.MarketplaceListing;
import com.aistareco.repository.MarketplaceListingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/marketplace")
@RequiredArgsConstructor
public class MarketplaceController {

    private final MarketplaceListingRepository listingRepo;

    /** GET /api/marketplace/listings */
    @GetMapping("/listings")
    public ApiResponse<List<MarketplaceListingDto>> listings() {
        List<MarketplaceListingDto> result = listingRepo.findAll().stream()
                .map(l -> new MarketplaceListingDto(
                        l.getId(), l.getArtistId(), l.getName(), l.getStyle(),
                        l.getAvatarUrl(), l.getPriceLabel(), l.getOwner(),
                        l.getSongs(), l.getFollowersLabel(), l.getDescription(),
                        l.isAutoReplyEnabled() ? true : null))
                .toList();
        return ApiResponse.of(result);
    }

    /** POST /api/marketplace/sign */
    @PostMapping("/sign")
    public ApiResponse<Map<String, Object>> sign(@RequestBody Map<String, Object> request) {
        String artistId = (String) request.getOrDefault("artistId", "");
        return ApiResponse.of(Map.of("success", true, "signedArtistId", artistId));
    }
}
