package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdvertisementDto;
import com.aistareco.aep.dto.DramaDto;
import com.aistareco.aep.dto.MovieDto;
import com.aistareco.aep.dto.VoiceWorkDto;
import com.aistareco.aep.repository.AdvertisementRepository;
import com.aistareco.aep.repository.DramaRepository;
import com.aistareco.aep.repository.MovieRepository;
import com.aistareco.aep.repository.VoiceWorkRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 用户侧影视业务只读视图：/api/film/*。
 * 管理写入仍走 {@link AdminFilmController}。
 */
@RestController
@RequestMapping("/api/film")
public class FilmController {

    private final DramaRepository dramaRepo;
    private final MovieRepository movieRepo;
    private final AdvertisementRepository adRepo;
    private final VoiceWorkRepository voiceWorkRepo;

    public FilmController(DramaRepository dramaRepo,
                          MovieRepository movieRepo,
                          AdvertisementRepository adRepo,
                          VoiceWorkRepository voiceWorkRepo) {
        this.dramaRepo = dramaRepo;
        this.movieRepo = movieRepo;
        this.adRepo = adRepo;
        this.voiceWorkRepo = voiceWorkRepo;
    }

    @GetMapping("/dramas")
    public ApiResponse<List<DramaDto>> dramas() {
        return ApiResponse.of(dramaRepo.findAll(Sort.by("id").ascending())
                .stream().map(DramaDto::from).toList());
    }

    @GetMapping("/movies")
    public ApiResponse<List<MovieDto>> movies() {
        return ApiResponse.of(movieRepo.findAll(Sort.by("id").ascending())
                .stream().map(MovieDto::from).toList());
    }

    @GetMapping("/ads")
    public ApiResponse<List<AdvertisementDto>> ads() {
        return ApiResponse.of(adRepo.findAll(Sort.by("id").ascending())
                .stream().map(AdvertisementDto::from).toList());
    }

    @GetMapping("/voice-works")
    public ApiResponse<List<VoiceWorkDto>> voiceWorks() {
        return ApiResponse.of(voiceWorkRepo.findAll(Sort.by("id").ascending())
                .stream().map(VoiceWorkDto::from).toList());
    }
}
