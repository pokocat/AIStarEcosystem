package com.aistareco.aep.aiavatar.service;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * 任务进度内存追踪 + SSE 推送（任务书 §5「进度经 pub/sub → SSE 推前端」）。
 *
 * - 进度 / 取消标志放内存（单实例够用；多实例需 Redis pub/sub，记 DECISIONS）。
 * - 前端 EventSource 订阅 {@code /api/me/aiavatar/jobs/{id}/stream}；轮询 {@code GET /jobs/{id}} 兜底。
 */
@Component
public class AiAvatarJobProgressTracker {

    public record Progress(int pct, String message, String status) {}

    private final Map<String, Progress> progress = new ConcurrentHashMap<>();
    private final Set<String> cancelled = new CopyOnWriteArraySet<>();
    private final Map<String, Set<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public void publish(String jobId, int pct, String message, String status) {
        Progress p = new Progress(pct, message, status);
        progress.put(jobId, p);
        Set<SseEmitter> set = emitters.get(jobId);
        if (set != null) {
            for (SseEmitter e : set) {
                try {
                    e.send(SseEmitter.event().name("progress").data(Map.of(
                            "job_id", jobId,
                            "progress", pct,
                            "message", message == null ? "" : message,
                            "status", status == null ? "" : status
                    )));
                } catch (IOException | IllegalStateException ex) {
                    set.remove(e);
                }
            }
        }
    }

    public Progress current(String jobId) {
        return progress.get(jobId);
    }

    public void complete(String jobId, String status) {
        Set<SseEmitter> set = emitters.remove(jobId);
        if (set != null) {
            for (SseEmitter e : set) {
                try {
                    e.send(SseEmitter.event().name("done").data(Map.of("job_id", jobId, "status", status)));
                    e.complete();
                } catch (Exception ignored) {}
            }
        }
        progress.remove(jobId);
    }

    public SseEmitter subscribe(String jobId) {
        SseEmitter emitter = new SseEmitter(0L); // no timeout; client closes
        emitters.computeIfAbsent(jobId, k -> new CopyOnWriteArraySet<>()).add(emitter);
        emitter.onCompletion(() -> removeEmitter(jobId, emitter));
        emitter.onTimeout(() -> removeEmitter(jobId, emitter));
        emitter.onError(ex -> removeEmitter(jobId, emitter));
        // 立即推一次当前进度，避免客户端等下一次 tick
        Progress p = progress.get(jobId);
        try {
            emitter.send(SseEmitter.event().name("progress").data(Map.of(
                    "job_id", jobId,
                    "progress", p == null ? 0 : p.pct(),
                    "message", p == null ? "等待中" : (p.message() == null ? "" : p.message()),
                    "status", p == null ? "queued" : (p.status() == null ? "" : p.status())
            )));
        } catch (Exception ignored) {}
        return emitter;
    }

    private void removeEmitter(String jobId, SseEmitter emitter) {
        Set<SseEmitter> set = emitters.get(jobId);
        if (set != null) set.remove(emitter);
    }

    public void markCancelled(String jobId) {
        cancelled.add(jobId);
    }

    public boolean isCancelled(String jobId) {
        return cancelled.contains(jobId);
    }

    public void clearCancel(String jobId) {
        cancelled.remove(jobId);
    }
}
