package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MusicGenreDto;
import com.aistareco.aep.repository.MusicGenreRepository;
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

    private final MusicGenreRepository genreRepo;

    public MusicController(MusicGenreRepository genreRepo) {
        this.genreRepo = genreRepo;
    }

    // 2026-08-29 安全修复：删除 /songs、/albums、/concerts 三个端点。
    // 它们落在 permitAll 段却直接 findAll()，任何未登录访问者都能拉到全平台所有用户的歌曲
    // （含未发布草稿、歌词、模型信息）。三者均未在 openapi 声明、也无任何前端调用
    // —— 用户侧读自己的资源走 /api/me/songs|albums|concerts（带归属过滤），
    // 运营侧走 /api/admin/music/*。曲风表是公共字典，保留。

    @GetMapping("/genres")
    public ApiResponse<List<MusicGenreDto>> genres() {
        return ApiResponse.of(genreRepo.findAll(Sort.by("id").ascending())
                .stream().map(MusicGenreDto::from).toList());
    }
}
