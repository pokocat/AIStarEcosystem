package com.aistareco.aep.dto;

import com.aistareco.aep.model.MusicGenJob;
import com.aistareco.aep.service.cdn.CdnUrlSigner;

import java.time.OffsetDateTime;

/**
 * MusicGenJobDto —— 对接前端 {@code packages/types/src/music.ts#MusicGenJob}。
 * 字段名严格匹配 TS 侧（§4.1）。
 *
 * <p>{@code audioUrl} 是**派生值**：DB 真值是 {@code audioCdnKey}，出 wire 时由
 * {@link CdnUrlSigner#signKey} 实时签名（§4.7.4），所以不会像存 URL 那样过期。
 */
public record MusicGenJobDto(
        String id,
        String status,
        int progress,
        String artistId,
        String songId,
        String prompt,
        String lyrics,
        String genre,
        String mood,
        String timbre,
        String gender,
        boolean instrumental,
        int durationSec,
        Integer actualDurationSec,
        String audioUrl,
        String resultLyrics,
        long creditsHeld,
        long creditsSettled,
        String errorMessage,
        String modelUsed,
        OffsetDateTime createdAt,
        OffsetDateTime completedAt
) {
    public static MusicGenJobDto from(MusicGenJob j, CdnUrlSigner signer) {
        String audioUrl = null;
        if (j.getAudioCdnKey() != null && !j.getAudioCdnKey().isBlank() && signer != null) {
            audioUrl = signer.signKey(j.getAudioCdnKey());
        }
        return new MusicGenJobDto(
                j.getId(),
                j.getStatus(),
                j.getProgress(),
                j.getArtistId(),
                j.getSongId(),
                j.getPrompt(),
                j.getLyrics(),
                j.getGenre(),
                j.getMood(),
                j.getTimbre(),
                j.getGender(),
                j.isInstrumental(),
                j.getDurationSec(),
                j.getActualDurationSec(),
                audioUrl,
                j.getResultLyrics(),
                j.getCreditsHeld(),
                j.getCreditsSettled(),
                j.getErrorMessage(),
                j.getModelUsed(),
                j.getCreatedAt(),
                j.getCompletedAt()
        );
    }
}
