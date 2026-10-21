package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.Event;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Authenticated SSE for one thread (§对话事件协议): replay persisted events after the cursor ({@code afterSeq} or
 * {@code Last-Event-ID}), then live events; event id = seq; a comment heartbeat every 15s that is not progress. A cursor
 * below the pruned floor (or beyond the thread) is 410 {@code STUDIO_EVENT_CURSOR_EXPIRED}: rebuild from the snapshot.
 * Closing the stream never cancels anything.
 */
@Component
public class StudioDialogueStream {
    private static final Logger log = LoggerFactory.getLogger(StudioDialogueStream.class);
    static final long TIMEOUT_MS = 30 * 60_000L;
    static final int PAGE = 500;
    private static final ScheduledExecutorService HEARTBEAT = Executors.newScheduledThreadPool(1, daemon("studio-dialogue-sse-ping"));
    private static final ExecutorService REPLAY = Executors.newCachedThreadPool(daemon("studio-dialogue-sse-replay"));

    private final StudioDialogueService service;
    private final IpDialogueEventRepository events;
    private final StudioDialogueEventHub hub;
    private final StudioDialogueStore store;

    public StudioDialogueStream(StudioDialogueService service, IpDialogueEventRepository events, StudioDialogueEventHub hub, StudioDialogueStore store) {
        this.service = service; this.events = events; this.hub = hub; this.store = store;
    }

    public SseEmitter open(String userId, String projectId, String threadId, Long afterSeq, String lastEventId) {
        IpDialogueThread thread = service.requireThread(userId, projectId, threadId);
        long cursor = afterSeq != null ? afterSeq : parse(lastEventId, thread.getLastSeq());
        if (cursor < thread.getEventFloorSeq() || cursor > thread.getLastSeq() || cursor < 0)
            throw new BusinessException(HttpStatus.GONE, "STUDIO_EVENT_CURSOR_EXPIRED", "对话记录已更新，请重新加载这条对话",
                    Map.of("latestSeq", thread.getLastSeq()));
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        Session session = session(threadId, emitter, cursor);
        Runnable unsubscribe = hub.subscribe(threadId, session::live);
        ScheduledFuture<?> ping = HEARTBEAT.scheduleAtFixedRate(session::ping, 15, 15, TimeUnit.SECONDS);
        Runnable close = () -> { unsubscribe.run(); ping.cancel(false); session.closed = true; };
        session.onGone = close;
        emitter.onCompletion(close);
        emitter.onTimeout(() -> { close.run(); emitter.complete(); });
        emitter.onError(e -> close.run());
        REPLAY.execute(() -> {
            try { session.replay(); }
            catch (RuntimeException e) { log.warn("[dialogue-sse] replay failed thread={}", threadId, e); emitter.completeWithError(e); }
        });
        return emitter;
    }

    Session session(String threadId, SseEmitter emitter, long cursor) { return new Session(threadId, emitter, cursor); }

    private static long parse(String lastEventId, long fallback) {
        if (lastEventId == null || lastEventId.isBlank()) return fallback;
        try { return Long.parseLong(lastEventId.strip()); } catch (NumberFormatException e) { return -1; }
    }

    final class Session {
        private final String threadId;
        private final SseEmitter emitter;
        private long lastSent;
        private boolean replaying = true;
        private final List<Event> pending = new ArrayList<>();
        volatile boolean closed;
        /** Leaves the hub and stops the heartbeat; run as soon as a write finds the client gone. */
        volatile Runnable onGone;

        Session(String threadId, SseEmitter emitter, long cursor) { this.threadId = threadId; this.emitter = emitter; this.lastSent = cursor; }

        synchronized void live(Event event) {
            if (closed) return;
            if (replaying) pending.add(event); else send(event);
        }

        void replay() {
            while (!closed) {
                long from;
                synchronized (this) { from = lastSent; }
                var page = events.findByThreadIdAndSeqGreaterThanOrderBySeqAsc(threadId, from, PageRequest.of(0, PAGE));
                synchronized (this) { for (var row : page) send(store.toDto(row)); }
                if (page.size() < PAGE) break;
            }
            synchronized (this) {
                pending.sort(Comparator.comparingLong(Event::seq));
                for (Event e : pending) send(e);
                pending.clear();
                replaying = false;
            }
        }

        /** Sends in seq order exactly once; a gap (event committed but not yet seen live) is filled from the store. */
        private void send(Event event) {
            if (closed || event.seq() <= lastSent) return;
            if (event.seq() > lastSent + 1 && !replaying) {
                for (var row : events.findByThreadIdAndSeqGreaterThanOrderBySeqAsc(threadId, lastSent, PageRequest.of(0, PAGE))) {
                    if (row.getSeq() >= event.seq()) break;
                    write(store.toDto(row));
                }
            }
            write(event);
        }

        private void write(Event event) {
            if (closed || event.seq() <= lastSent) return;
            try {
                emitter.send(SseEmitter.event().id(String.valueOf(event.seq())).data(event, MediaType.APPLICATION_JSON));
                lastSent = event.seq();
            } catch (IOException | IllegalStateException e) {
                gone(e);
            }
        }

        synchronized void ping() {
            if (closed) return;
            try { emitter.send(SseEmitter.event().comment("ping")); }
            catch (IOException | IllegalStateException e) { gone(e); }
        }

        /**
         * The client went away (switching or starting a conversation closes the old stream every time). Not an error:
         * one DEBUG line, and the session leaves the hub and stops its heartbeat now instead of at the container's error
         * dispatch or the 30-minute timeout. The emitter is not completed here: after a failed send Spring ignores it and
         * the container ends the request (its error is a client disconnect, see GlobalExceptionHandler#isClientDisconnect).
         */
        private void gone(Exception e) {
            if (closed) return;
            closed = true;
            log.debug("[dialogue-sse] client gone thread={}: {}", threadId, e.toString());
            Runnable release = onGone;
            if (release != null) release.run();
        }
    }

    private static java.util.concurrent.ThreadFactory daemon(String name) {
        return r -> { Thread t = new Thread(r, name); t.setDaemon(true); return t; };
    }
}
