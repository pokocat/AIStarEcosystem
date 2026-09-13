package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.repository.AdvertisementRepository;
import com.aistareco.aep.repository.DramaRepository;
import com.aistareco.aep.repository.MovieRepository;
import com.aistareco.aep.repository.VoiceWorkRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/film")
public class AdminFilmController {

    private final DramaRepository dramaRepo;
    private final MovieRepository movieRepo;
    private final AdvertisementRepository adRepo;
    private final VoiceWorkRepository voiceWorkRepo;

    public AdminFilmController(DramaRepository dramaRepo,
                               MovieRepository movieRepo,
                               AdvertisementRepository adRepo,
                               VoiceWorkRepository voiceWorkRepo) {
        this.dramaRepo = dramaRepo;
        this.movieRepo = movieRepo;
        this.adRepo = adRepo;
        this.voiceWorkRepo = voiceWorkRepo;
    }

    @GetMapping("/dramas")
    public PageEnvelope<DramaDto> dramas(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // page/size 是未校验入参；PageRequest.of 对 page<0 或 size<1 抛 IllegalArgumentException → 500。
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 100);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("id").ascending());
        return PageEnvelope.from(dramaRepo.findAll(pageable).map(DramaDto::from));
    }

    @GetMapping("/movies")
    public PageEnvelope<MovieDto> movies(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // page/size 是未校验入参；PageRequest.of 对 page<0 或 size<1 抛 IllegalArgumentException → 500。
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 100);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("id").ascending());
        return PageEnvelope.from(movieRepo.findAll(pageable).map(MovieDto::from));
    }

    @GetMapping("/ads")
    public PageEnvelope<AdvertisementDto> ads(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // page/size 是未校验入参；PageRequest.of 对 page<0 或 size<1 抛 IllegalArgumentException → 500。
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 100);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("id").ascending());
        return PageEnvelope.from(adRepo.findAll(pageable).map(AdvertisementDto::from));
    }

    @GetMapping("/voice-works")
    public PageEnvelope<VoiceWorkDto> voiceWorks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // page/size 是未校验入参；PageRequest.of 对 page<0 或 size<1 抛 IllegalArgumentException → 500。
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 100);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("id").ascending());
        return PageEnvelope.from(voiceWorkRepo.findAll(pageable).map(VoiceWorkDto::from));
    }
}
