package com.aistareco.aep.controller;

import com.aistareco.aep.dto.FanArtistDto;
import com.aistareco.aep.dto.FanProfileDto;
import com.aistareco.aep.dto.NFTItemDto;
import com.aistareco.aep.dto.TrackItemDto;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/fan")
public class AdminFanController {

    @GetMapping("/trending-artists")
    public ApiResponse<List<FanArtistDto>> trendingArtists() {
        return ApiResponse.of(List.of());
    }

    @GetMapping("/hot-tracks")
    public ApiResponse<List<TrackItemDto>> hotTracks() {
        return ApiResponse.of(List.of());
    }

    @GetMapping("/nft-market")
    public ApiResponse<List<NFTItemDto>> nftMarket() {
        return ApiResponse.of(List.of());
    }

    @GetMapping("/overview")
    public ApiResponse<FanProfileDto> overview() {
        return ApiResponse.of(null);
    }
}
