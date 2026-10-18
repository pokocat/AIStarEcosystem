package com.aistareco.aep.ipstudio.dialogue;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.time.Instant;

/**
 * Background repair: threads whose active turn died (restart, lost executor thread) are reconciled so their pointer and
 * hold do not wait for the generic 15-minute reaper; old event rows are pruned behind a per-thread floor (a resume cursor
 * below it gets 410 and rebuilds from the snapshot — messages are never pruned).
 */
@Component
public class StudioDialogueSweeper {
    private static final Logger log = LoggerFactory.getLogger(StudioDialogueSweeper.class);
    static final Duration EVENT_RETENTION = Duration.ofDays(14);
    private final IpDialogueThreadRepository threads;
    private final IpDialogueEventRepository events;
    private final StudioDialogueService service;
    private final StudioDialogueStore store;

    public StudioDialogueSweeper(IpDialogueThreadRepository threads, IpDialogueEventRepository events, StudioDialogueService service, StudioDialogueStore store) {
        this.threads = threads; this.events = events; this.service = service; this.store = store;
    }

    @Scheduled(fixedDelay = 60_000L, initialDelay = 60_000L)
    public void reconcileActive() {
        for (var thread : threads.findByActiveRunIdIsNotNull()) {
            try { service.reconcile(thread.getId()); }
            catch (RuntimeException e) { log.warn("[dialogue] reconcile failed thread={}: {}", thread.getId(), e.toString()); }
        }
    }

    @Scheduled(fixedDelay = 6 * 3_600_000L, initialDelay = 300_000L)
    public void pruneEvents() {
        Instant cutoff = Instant.now().minus(EVENT_RETENTION);
        for (String threadId : events.threadsWithEventsBefore(cutoff, PageRequest.of(0, 200))) {
            try {
                store.write(threadId, t -> {
                    Long through = events.maxSeqBefore(threadId, cutoff);
                    if (through != null && through > t.getEventFloorSeq()) {
                        events.deleteThrough(threadId, through);
                        t.setEventFloorSeq(through);
                    }
                    return java.util.List.of();
                });
            } catch (RuntimeException e) { log.warn("[dialogue] event prune failed thread={}: {}", threadId, e.toString()); }
        }
    }
}
