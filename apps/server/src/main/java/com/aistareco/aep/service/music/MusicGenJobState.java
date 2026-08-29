package com.aistareco.aep.service.music;

import com.aistareco.aep.model.MusicGenJob;
import com.aistareco.aep.model.Song;
import com.aistareco.aep.repository.MusicGenJobRepository;
import com.aistareco.aep.repository.SongRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 音乐生成任务的事务边界。
 *
 * <p>单独成 bean 而不是塞进 worker：worker 的推进方法是 {@code @Async} 的，
 * 在同一个 bean 内部自调用 {@code @Transactional} 方法会绕过代理导致事务不生效。
 * clip 域的 {@code ClipRenderWorkerState} 是同样的理由。
 */
@Service
public class MusicGenJobState {

    private final MusicGenJobRepository jobRepo;
    private final SongRepository songRepo;

    public MusicGenJobState(MusicGenJobRepository jobRepo, SongRepository songRepo) {
        this.jobRepo = jobRepo;
        this.songRepo = songRepo;
    }

    @Transactional(readOnly = true)
    public Optional<MusicGenJob> find(String id) {
        return jobRepo.findById(id);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markStatus(String id, String status, int progress) {
        jobRepo.findById(id).ifPresent(j -> {
            j.setStatus(status);
            j.setProgress(progress);
            j.setUpdatedAt(OffsetDateTime.now());
            j.setHeartbeatAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    /** 心跳单独更新：reaper 靠它判断 worker 还活着。 */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void heartbeat(String id, int progress) {
        jobRepo.findById(id).ifPresent(j -> {
            j.setProgress(progress);
            j.setUpdatedAt(OffsetDateTime.now());
            j.setHeartbeatAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markGenerating(String id, String taskId, String provider, String model) {
        jobRepo.findById(id).ifPresent(j -> {
            j.setStatus("generating");
            j.setProgress(Math.max(j.getProgress(), 10));
            j.setExternalTaskId(taskId);
            j.setProviderUsed(provider);
            j.setModelUsed(model);
            j.setUpdatedAt(OffsetDateTime.now());
            j.setHeartbeatAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(String id, String message) {
        jobRepo.findById(id).ifPresent(j -> {
            j.setStatus("failed");
            j.setErrorMessage(truncate(message, 1000));
            j.setUpdatedAt(OffsetDateTime.now());
            j.setCompletedAt(OffsetDateTime.now());
            j.setHeartbeatAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    /**
     * 成功落地：写产物 + 建歌曲行。歌曲与任务在同一事务里落，避免出现
     * 「任务成功但歌曲没建」的孤儿态。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String markSucceeded(String id, String audioCdnKey, long audioBytes,
                                Integer actualDurationSec, String resultLyrics,
                                String resultCaptions, long creditsSettled, String title) {
        MusicGenJob j = jobRepo.findById(id).orElse(null);
        if (j == null) return null;

        String songId = "s-" + UUID.randomUUID().toString().substring(0, 8);
        Song song = Song.builder()
                .id(songId)
                .title(title)
                .genre(j.getGenre() == null ? "Pop" : j.getGenre())
                .duration(actualDurationSec != null ? actualDurationSec : j.getDurationSec())
                .status(Song.SongStatus.RECORDING)
                .plays(0)
                .revenue(0)
                .rating(0)
                .artistId(j.getArtistId())
                .ownerUserId(j.getOwnerUserId())
                .audioCdnKey(audioCdnKey)
                .lyrics(resultLyrics != null ? resultLyrics : j.getLyrics())
                .modelVersion(j.getModelUsed())
                .creditsSpent(creditsSettled)
                .createdAt(java.time.Instant.now())
                .build();
        songRepo.save(song);

        j.setStatus("succeeded");
        j.setProgress(100);
        j.setAudioCdnKey(audioCdnKey);
        j.setAudioBytes(audioBytes);
        j.setActualDurationSec(actualDurationSec);
        j.setResultLyrics(resultLyrics);
        j.setResultCaptions(resultCaptions);
        j.setCreditsSettled(creditsSettled);
        j.setSongId(songId);
        j.setUpdatedAt(OffsetDateTime.now());
        j.setCompletedAt(OffsetDateTime.now());
        j.setHeartbeatAt(OffsetDateTime.now());
        jobRepo.save(j);
        return songId;
    }

    @Transactional(readOnly = true)
    public List<MusicGenJob> findStale(OffsetDateTime before) {
        return jobRepo.findTop100ByStatusInAndHeartbeatAtBefore(
                List.of("queued", "submitting", "generating"), before);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
