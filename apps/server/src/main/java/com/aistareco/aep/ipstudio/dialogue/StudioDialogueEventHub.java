package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.Event;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.Consumer;

/**
 * In-process live fan-out keyed by thread (single node, as S1 specifies). Only committed events are broadcast; a missed
 * broadcast is harmless because subscribers resume from the persisted event rows by seq.
 */
@Component
public class StudioDialogueEventHub {
    private static final Logger log = LoggerFactory.getLogger(StudioDialogueEventHub.class);
    private final Map<String, Set<Consumer<Event>>> subscribers = new ConcurrentHashMap<>();

    public Runnable subscribe(String threadId, Consumer<Event> listener) {
        subscribers.computeIfAbsent(threadId, k -> new CopyOnWriteArraySet<>()).add(listener);
        return () -> subscribers.computeIfPresent(threadId, (k, set) -> { set.remove(listener); return set.isEmpty() ? null : set; });
    }

    public void broadcast(Event event) {
        var set = subscribers.get(event.threadId());
        if (set == null) return;
        for (var listener : set) {
            try { listener.accept(event); }
            catch (RuntimeException e) { log.debug("[dialogue-sse] subscriber failed thread={} seq={}: {}", event.threadId(), event.seq(), e.toString()); }
        }
    }

    int subscriberCount(String threadId) { var set = subscribers.get(threadId); return set == null ? 0 : set.size(); }
}
