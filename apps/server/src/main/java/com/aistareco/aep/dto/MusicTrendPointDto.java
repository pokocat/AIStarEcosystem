package com.aistareco.aep.dto;

/**
 * 近 N 天音乐业务趋势点。字段名严格对齐前端 TS：
 * {@code packages/types/src/music.ts} 的 {@code MusicTrendPoint}。
 *
 * @param date   YYYY-MM-DD
 * @param plays  当日累计播放
 * @param revenue 当日累计收入（credits）
 */
public record MusicTrendPointDto(
        String date,
        long plays,
        long revenue
) {}
