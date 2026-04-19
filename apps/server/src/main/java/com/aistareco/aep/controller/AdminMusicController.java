package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.model.Song;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.repository.AlbumRepository;
import com.aistareco.aep.repository.ConcertRepository;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.MusicGenreRepository;
import com.aistareco.aep.repository.SongRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/music")
public class AdminMusicController {

    private final SongRepository songRepo;
    private final AlbumRepository albumRepo;
    private final ConcertRepository concertRepo;
    private final MusicGenreRepository genreRepo;
    private final DigitalIpRepository digitalIpRepo;
    private final StudioRepository studioRepo;

    public AdminMusicController(SongRepository songRepo,
                                AlbumRepository albumRepo,
                                ConcertRepository concertRepo,
                                MusicGenreRepository genreRepo,
                                DigitalIpRepository digitalIpRepo,
                                StudioRepository studioRepo) {
        this.songRepo = songRepo;
        this.albumRepo = albumRepo;
        this.concertRepo = concertRepo;
        this.genreRepo = genreRepo;
        this.digitalIpRepo = digitalIpRepo;
        this.studioRepo = studioRepo;
    }

    @GetMapping("/songs")
    public PageEnvelope<SongDto> songs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String studioId,
            @RequestParam(required = false) String artistId) {
        // 先全量加载并 enrich，再做 studio/artist 二次过滤 + 手工分页。
        // MVP 量级小（单 studio 几十首歌），不值得为这两个筛选新增 repository 方法。
        List<Song> all = songRepo.findAll(Sort.by("id").ascending());
        Map<String, DigitalIp> artistMap = batchLoadArtists(all);
        Map<String, Studio> studioMap = batchLoadStudios(artistMap.values());

        List<SongDto> filtered = all.stream()
                .map(s -> enrich(s, artistMap, studioMap))
                .filter(dto -> studioId == null || studioId.isBlank() || studioId.equals(dto.studioId()))
                .filter(dto -> artistId == null || artistId.isBlank() || artistId.equals(dto.artistId()))
                .toList();

        int total = filtered.size();
        int from = Math.min(page * size, total);
        int to = Math.min(from + size, total);
        List<SongDto> slice = filtered.subList(from, to);
        int totalPages = size > 0 ? (int) Math.ceil(total / (double) size) : 0;
        return new PageEnvelope<>(true, slice,
                new PageEnvelope.PaginationMeta(page, size, total, totalPages,
                        page + 1 < totalPages, page > 0),
                null);
    }

    @GetMapping("/songs/{id}")
    public ApiResponse<SongDto> songById(@PathVariable String id) {
        Song s = loadSong(id);
        Map<String, DigitalIp> artistMap = batchLoadArtists(List.of(s));
        Map<String, Studio> studioMap = batchLoadStudios(artistMap.values());
        return ApiResponse.of(enrich(s, artistMap, studioMap));
    }

    private Map<String, DigitalIp> batchLoadArtists(java.util.Collection<Song> songs) {
        Set<String> artistIds = songs.stream()
                .map(Song::getArtistId)
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.toSet());
        if (artistIds.isEmpty()) return Map.of();
        Map<String, DigitalIp> map = new HashMap<>();
        digitalIpRepo.findAllById(artistIds).forEach(a -> map.put(a.getId(), a));
        return map;
    }

    private Map<String, Studio> batchLoadStudios(java.util.Collection<DigitalIp> artists) {
        Set<String> studioIds = new HashSet<>();
        for (DigitalIp a : artists) {
            if (a.getStudioId() != null) studioIds.add(a.getStudioId());
        }
        if (studioIds.isEmpty()) return Map.of();
        Map<String, Studio> map = new HashMap<>();
        studioRepo.findAllById(studioIds).forEach(s -> map.put(s.getId(), s));
        return map;
    }

    /** 填充 artistName / studioId / studioName（两跳 artist → studio）。 */
    private SongDto enrich(Song s, Map<String, DigitalIp> artistMap, Map<String, Studio> studioMap) {
        DigitalIp artist = s.getArtistId() == null ? null : artistMap.get(s.getArtistId());
        if (artist == null) return SongDto.from(s, null, null, null);
        String studioId = artist.getStudioId();
        String studioName = studioId == null ? null :
                (studioMap.get(studioId) == null ? null : studioMap.get(studioId).getName());
        return SongDto.from(s, artist.getName(), studioId, studioName);
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
