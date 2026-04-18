package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AlbumDto;
import com.aistareco.aep.dto.ConcertDto;
import com.aistareco.aep.dto.MusicGenreDto;
import com.aistareco.aep.dto.SongDto;
import com.aistareco.aep.repository.AlbumRepository;
import com.aistareco.aep.repository.ConcertRepository;
import com.aistareco.aep.repository.MusicGenreRepository;
import com.aistareco.aep.repository.SongRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 用户侧音乐业务只读视图：/api/music/*。
 * 管理写入仍走 {@link AdminMusicController}。
 */
@RestController
@RequestMapping("/api/music")
public class MusicController {

    private final SongRepository songRepo;
    private final AlbumRepository albumRepo;
    private final ConcertRepository concertRepo;
    private final MusicGenreRepository genreRepo;

    public MusicController(SongRepository songRepo,
                           AlbumRepository albumRepo,
                           ConcertRepository concertRepo,
                           MusicGenreRepository genreRepo) {
        this.songRepo = songRepo;
        this.albumRepo = albumRepo;
        this.concertRepo = concertRepo;
        this.genreRepo = genreRepo;
    }

    @GetMapping("/songs")
    public ApiResponse<List<SongDto>> songs() {
        return ApiResponse.of(songRepo.findAll(Sort.by("id").ascending())
                .stream().map(SongDto::from).toList());
    }

    @GetMapping("/albums")
    public ApiResponse<List<AlbumDto>> albums() {
        return ApiResponse.of(albumRepo.findAll(Sort.by("id").ascending())
                .stream().map(AlbumDto::from).toList());
    }

    @GetMapping("/concerts")
    public ApiResponse<List<ConcertDto>> concerts() {
        return ApiResponse.of(concertRepo.findAll(Sort.by("id").ascending())
                .stream().map(ConcertDto::from).toList());
    }

    @GetMapping("/genres")
    public ApiResponse<List<MusicGenreDto>> genres() {
        return ApiResponse.of(genreRepo.findAll(Sort.by("id").ascending())
                .stream().map(MusicGenreDto::from).toList());
    }
}
