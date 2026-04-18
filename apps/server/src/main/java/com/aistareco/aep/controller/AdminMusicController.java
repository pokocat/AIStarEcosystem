package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.Song;
import com.aistareco.aep.repository.AlbumRepository;
import com.aistareco.aep.repository.ConcertRepository;
import com.aistareco.aep.repository.MusicGenreRepository;
import com.aistareco.aep.repository.SongRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;

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

    @GetMapping("/songs/{id}")
    public ApiResponse<SongDto> songById(@PathVariable String id) {
        return ApiResponse.of(SongDto.from(loadSong(id)));
    }

    /**
     * 审核通过并发行。默认策略：新建音乐自动通过上架，本接口用于人工复核场景。
     * body: {@code { "reason": "..." }}（可选，写入审计日志由上层过滤器负责）。
     */
    @PostMapping("/songs/{id}/approve")
    public ApiResponse<SongDto> approveSong(@PathVariable String id,
                                            @RequestBody(required = false) Map<String, Object> body) {
        Song song = loadSong(id);
        song.setStatus(Song.SongStatus.RELEASED);
        if (song.getReleaseDate() == null) {
            song.setReleaseDate(Instant.now());
        }
        return ApiResponse.of(SongDto.from(songRepo.save(song)));
    }

    /** 驳回并下架（需填写 reason）。 */
    @PostMapping("/songs/{id}/reject")
    public ApiResponse<SongDto> rejectSong(@PathVariable String id,
                                           @RequestBody(required = false) Map<String, Object> body) {
        Song song = loadSong(id);
        song.setStatus(Song.SongStatus.MIXING);
        song.setReleaseDate(null);
        return ApiResponse.of(SongDto.from(songRepo.save(song)));
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

    private Song loadSong(String id) {
        return songRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found: " + id));
    }
}
