package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;

@Service
public class StudioMediaJobs {
    private static final Logger log = LoggerFactory.getLogger(StudioMediaJobs.class);
    private static final long LEASE = Duration.ofMinutes(15).toMillis();
    private static final long RETENTION = Duration.ofDays(7).toMillis();
    private static final String SOURCE = StudioMediaImportService.SOURCE;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final ObjectMapper json;
    private final FileStorageService storage;
    private final StorageQuotaService quota;
    private final IpProjectService projects;
    private final IpLibraryService library;
    private final AepUserRepository users;
    private final StudioMediaImportService media;

    public StudioMediaJobs(JdbcTemplate jdbc, PlatformTransactionManager transactionManager, ObjectMapper json,
                           FileStorageService storage, StorageQuotaService quota, IpProjectService projects,
                           IpLibraryService library, AepUserRepository users, StudioMediaImportService media) {
        this.jdbc = jdbc;
        this.transactions = new TransactionTemplate(transactionManager);
        this.json = json;
        this.storage = storage;
        this.quota = quota;
        this.projects = projects;
        this.library = library;
        this.users = users;
        this.media = media;
    }

    private record Input(String source, String output, String name, String folder, Double start, Double end) {
        boolean excerpt() { return start != null; }
    }
    private record Row(String id, String owner, String state, Input input,
                       StudioMediaImportService.MediaImportResult result, String code, String message) {}
    public record Status(String id, String status, StudioMediaImportService.MediaImportResult result,
                         String errorCode, String errorMessage) {}
    public record ClipRequest(String storageKey, String title, double start, double end, UUID requestId) {}
    public record VideoInfo(double durationSec) {}

    Status normalize(String user, StudioMediaImportService.VideoInput video, String folder) throws IOException {
        var input = new Input(storage.allocateKey(SOURCE, user, "original.mp4"), storage.allocateKey(SOURCE, user, "preview.mp4"),
                video.name(), folder, null, null);
        String id = enqueue(user, input, "receiving");
        try {
            storage.storeAllocated(video.file(), SOURCE, user, input.source(), "video/mp4");
            if (jdbc.update("UPDATE studio_media_job SET state='queued', updated_at=? WHERE id=? AND state='receiving'",
                    now(), id) != 1) {
                throw new IOException("The upload session has expired");
            }
        } catch (IOException | RuntimeException failure) {
            storage.delete(input.source());
            jdbc.update("DELETE FROM studio_media_job WHERE id=? AND state='receiving'", id);
            throw failure;
        }
        return new Status(id, "queued", null, null, null);
    }

    public VideoInfo info(String user, String key) {
        return new VideoInfo(readSource(requireSourceKey(user, key)).probe().durationSec());
    }

    public Status clip(String user, ClipRequest request) {
        double start = request.start(), end = request.end();
        if (!Double.isFinite(start) || !Double.isFinite(end) || start < 0 || end - start < .5 - .000001
                || end - start > StudioMediaImportService.REFERENCE_VIDEO_MAX_SECONDS + .000001) {
            throw BusinessException.badRequest("STUDIO_MEDIA_RANGE_INVALID", "请选择 0.5 至 60 秒的视频片段");
        }
        String key = requireSourceKey(user, request.storageKey());
        String replayId = request.requestId() == null ? newJobId() : "SMJ-" + UUID.nameUUIDFromBytes(
                (user + ":" + request.requestId()).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString().replace("-", "");
        var prior = clipReplay(user, replayId, key, start, end);
        if (prior != null) return prior;
        var source = readSource(key);
        if (end > source.probe().durationSec() + .001) {
            throw BusinessException.badRequest("STUDIO_MEDIA_RANGE_INVALID", "截取终点超过原片时长");
        }
        String name = StudioMediaImportService.fileName(request.title()).replaceFirst("(?i)\\.mp4$", "");
        return transactions.execute(tx -> {
            lockUser(user);
            var existing = clipReplay(user, replayId, key, start, end);
            if (existing != null) return existing;
            checkCapacity(user);
            insert(user, replayId, new Input(key, storage.allocateKey(SOURCE, user, "clip.mp4"),
                    name + " · 片段.mp4", null, start, end), "queued");
            return new Status(replayId, "queued", null, null, null);
        });
    }

    private Status clipReplay(String user, String id, String key, double start, double end) {
        Row row = findOwned(user, id);
        if (row == null) return null;
        Input input = row.input();
        if (!input.excerpt() || !key.equals(input.source()) || start != input.start() || end != input.end()) {
            throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_MEDIA_RANGE_CHANGED", "片段范围已更改，请重新截取");
        }
        return wire(row);
    }

    private String requireSourceKey(String user, String rawKey) {
        String key = projects.requireOwnedAssetKey(user, rawKey);
        if (key == null) throw BusinessException.badRequest("STUDIO_MEDIA_INVALID", "请选择视频");
        return key;
    }

    private StudioMediaImportService.VideoSource readSource(String key) {
        try {
            return media.inspectVideo(storage.openForRead(key));
        } catch (IOException e) {
            throw BusinessException.badRequest("STUDIO_MEDIA_INVALID", "视频无法读取，请重新选择");
        }
    }

    public Status status(String user, String id) {
        return wire(owned(user, id));
    }

    private Status wire(Row row) {
        var result = row.result();
        if (result != null) {
            result = new StudioMediaImportService.MediaImportResult(result.key(), storage.signedUrl(result.key()), result.mediaType(),
                    result.mimeType(), result.bytes(), result.fileName(), result.width(), result.height(), result.durationSec());
        }
        return new Status(row.id(), row.state(), result, row.code(), row.message());
    }

    public Status retry(String user, String id) {
        transactions.executeWithoutResult(tx -> {
            lockUser(user);
            Row row = owned(user, id);
            if (!"failed".equals(row.state())) return;
            checkCapacity(user);
            jdbc.update("""
                    UPDATE studio_media_job SET state='queued', error_code=NULL, error_message=NULL, lease_until=0, updated_at=?
                    WHERE id=? AND owner_user_id=? AND state='failed'
                    """, now(), id, user);
        });
        return status(user, id);
    }

    private String enqueue(String user, Input input, String state) {
        String id = newJobId();
        return transactions.execute(tx -> {
            lockUser(user);
            checkCapacity(user);
            insert(user, id, input, state);
            return id;
        });
    }

    private static String newJobId() {
        return "SMJ-" + UUID.randomUUID().toString().replace("-", "");
    }

    private void insert(String user, String id, Input input, String state) {
        long now = now();
        jdbc.update("""
                INSERT INTO studio_media_job(id, owner_user_id, state, input_json, created_at, updated_at, lease_until)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, user, state, encode(input), now, now, "receiving".equals(state) ? now + LEASE : 0);
    }

    private void lockUser(String user) {
        users.findByIdForUpdate(user).orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "账号不存在"));
    }

    private void checkCapacity(String user) {
        Long waiting = jdbc.queryForObject("""
                SELECT count(*) FROM studio_media_job WHERE owner_user_id=? AND state IN ('receiving','queued','processing')
                """, Long.class, user);
        if (waiting != null && waiting >= 5) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "STUDIO_MEDIA_QUEUE_FULL", "已有 5 个视频在处理中，请稍后再试");
        }
    }

    private Row owned(String user, String id) {
        Row row = findOwned(user, id);
        if (row == null) throw BusinessException.notFound("STUDIO_MEDIA_JOB_NOT_FOUND", "视频处理记录已失效");
        return row;
    }

    private Row findOwned(String user, String id) {
        return jdbc.query("""
                SELECT id, owner_user_id, state, input_json, result_json, error_code, error_message
                FROM studio_media_job WHERE id=? AND owner_user_id=? AND state NOT IN ('receiving','expired')
                """, (rs, n) -> new Row(rs.getString(1), rs.getString(2), rs.getString(3), decode(rs.getString(4), Input.class),
                        decode(rs.getString(5), StudioMediaImportService.MediaImportResult.class), rs.getString(6), rs.getString(7)),
                id, user).stream().findFirst().orElse(null);
    }

    public void dispatch() {
        long now = now();
        var rows = jdbc.query("""
                SELECT id, owner_user_id FROM studio_media_job
                WHERE state='queued' OR (state='processing' AND lease_until<?)
                ORDER BY created_at, id LIMIT 1
                """, (rs, n) -> new String[]{rs.getString(1), rs.getString(2)}, now);
        if (rows.isEmpty()) return;
        String id = rows.get(0)[0], user = rows.get(0)[1];
        long lease = now + LEASE;
        if (jdbc.update("""
                UPDATE studio_media_job SET state='processing', lease_until=?, updated_at=?
                WHERE id=? AND (state='queued' OR (state='processing' AND lease_until<?))
                """, lease, now, id, now) != 1) return;

        Path output = null;
        try {
            Row row = owned(user, id);
            Path original = storage.openForRead(row.input().source());
            var video = media.inspectVideo(original);
            output = Files.createTempFile("studio-media-output-", ".mp4");
            var rendered = media.renderVideo(video, output, row.input().start(), row.input().end());
            long originalBytes = row.input().excerpt() ? 0 : Files.size(original);
            media.checkQuota(user, Math.addExact(originalBytes, Files.size(output)));
            var stored = storage.storeAllocated(output, SOURCE, user, row.input().output(), "video/mp4");
            var result = media.videoResult(stored, rendered.probe(), row.input().name());
            complete(row, lease, result);
            recordUsage(row, result, originalBytes);
        } catch (Exception e) {
            if (jdbc.update("""
                    UPDATE studio_media_job SET state='failed', error_code=?, error_message=?, lease_until=0, updated_at=?
                    WHERE id=? AND state='processing' AND lease_until=?
                    """, e instanceof BusinessException business ? business.getCode() : "STUDIO_VIDEO_PROCESSING_FAILED",
                    e instanceof BusinessException ? e.getMessage() : "视频处理未完成，请重试", now(), id, lease) == 1) {
                log.warn("[studio-media] processing failed job={} type={}", id, e.getClass().getSimpleName(), e);
            }
        } finally { StudioMediaImportService.deleteTemp(output); }
    }

    private void recordUsage(Row row, StudioMediaImportService.MediaImportResult result, long originalBytes) {
        try {
            quota.record("aiavatar", row.owner(), "上传的素材", null, result.key(), result.bytes());
            if (!row.input().excerpt()) quota.record("aiavatar", row.owner(), "上传的素材", null, row.input().source(), originalBytes);
        } catch (RuntimeException e) {
            log.warn("[studio-media] usage recording failed job={}", row.id(), e);
        }
    }

    private void complete(Row row, long lease, StudioMediaImportService.MediaImportResult result) {
        transactions.executeWithoutResult(tx -> {
            // Store only the key and measured metadata. Status signs the URL when requested.
            var persisted = new StudioMediaImportService.MediaImportResult(result.key(), null, result.mediaType(),
                    result.mimeType(), result.bytes(), result.fileName(), result.width(), result.height(), result.durationSec());
            if (jdbc.update("""
                    UPDATE studio_media_job SET state='done', result_json=?, lease_until=0, updated_at=?
                    WHERE id=? AND state='processing' AND lease_until=?
                    """, encode(persisted), now(), row.id(), lease) != 1) {
                throw new IllegalStateException("Video processing claim expired");
            }
            String folder = row.input().folder();
            try {
                library.checkFolder(row.owner(), folder);
            } catch (BusinessException error) {
                if (!"IP_LIBRARY_NOT_FOUND".equals(error.getCode())) throw error;
                folder = null;
            }
            media.saveAsset(row.owner(), result, folder, row.input().excerpt() ? null : row.input().source());
        });
    }

    public void expire() {
        long now = now();
        var ids = jdbc.query("""
                SELECT id FROM studio_media_job WHERE (state='failed' AND updated_at<?)
                   OR (state='receiving' AND lease_until<?) OR state='expired' ORDER BY created_at LIMIT 100
                """, (rs, n) -> rs.getString(1), now - RETENTION, now);
        for (String id : ids) {
            if (jdbc.update("""
                    UPDATE studio_media_job SET state='expired'
                    WHERE id=? AND ((state='failed' AND updated_at<?) OR (state='receiving' AND lease_until<?) OR state='expired')
                    """, id, now - RETENTION, now) != 1) continue;
            String payload = jdbc.queryForObject("SELECT input_json FROM studio_media_job WHERE id=?", String.class, id);
            var input = decode(payload, Input.class);
            if (!input.excerpt()) storage.delete(input.source());
            storage.delete(input.output());
            jdbc.update("DELETE FROM studio_media_job WHERE id=? AND state='expired'", id);
        }
        jdbc.update("DELETE FROM studio_media_job WHERE state='done' AND updated_at<?", now - RETENTION);
    }

    private static long now() { return System.currentTimeMillis(); }

    private String encode(Object value) {
        try { return json.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot store media job", e); }
    }

    private <T> T decode(String value, Class<T> type) {
        if (value == null) return null;
        try { return json.readValue(value, type); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot read media job", e); }
    }
}
