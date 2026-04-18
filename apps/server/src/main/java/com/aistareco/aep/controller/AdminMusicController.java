package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.repository.AlbumRepository;
import com.aistareco.aep.repository.ConcertRepository;
import com.aistareco.aep.repository.MusicGenreRepository;
import com.aistareco.aep.repository.SongRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/music")
public class AdminMusicController {

    private final SongRepository songRepo;
    private final AlbumRepository albumRepo;
    private final ConcertRepository concertRepo;
    private final MusicGenreRepository genreRepo;

    public AdminMusicController(SongRepository songRepo,
                                AlbumRepository albumRepo,
                                ConcertRepository concertRepo,
                                MusicGenreRepository genreRepo) {
        this.songRepo = songRepo;
        this.albumRepo = albumRepo;
        this.concertRepo = concertRepo;
        this.genreRepo = genreRepo;
    }

    @GetMapping("/songs")
    public PageEnvelope<SongDto> songs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("id").ascending());
        return PageEnvelope.from(songRepo.findAll(pageable).map(SongDto::from));
    }

    @GetMapping("/albums")
    public PageEnvelope<AlbumDto> albums(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("id").ascending());
        return PageEnvelope.from(albumRepo.findAll(pageable).map(AlbumDto::from));
    }

    @GetMapping("/concerts")
    public PageEnvelope<ConcertDto> concerts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("id").ascending());
        return PageEnvelope.from(concertRepo.findAll(pageable).map(ConcertDto::from));
    }

    @GetMapping("/genres")
    public PageEnvelope<MusicGenreDto> genres(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("id").ascending());
        return PageEnvelope.from(genreRepo.findAll(pageable).map(MusicGenreDto::from));
    }
}
