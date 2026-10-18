package com.aistareco.aep.ipstudio.dialogue;

import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * In-process fast path for the priority stop: the control endpoint flips the flag of a turn running on this node so a
 * live stream is closed within the watchdog tick. The durable truth stays {@code IpRun.cancelRequested}.
 */
@Component
public class StudioDialogueSignals {
    private final Map<String, AtomicBoolean> stops = new ConcurrentHashMap<>();
    AtomicBoolean register(String runId) { return stops.computeIfAbsent(runId, k -> new AtomicBoolean(false)); }
    void remove(String runId) { stops.remove(runId); }
    public void stop(String runId) { var flag = stops.get(runId); if (flag != null) flag.set(true); }
}
