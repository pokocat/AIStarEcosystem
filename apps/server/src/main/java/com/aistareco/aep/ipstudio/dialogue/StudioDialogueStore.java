package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.Event;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Persistence of dialogue state changes together with the events that describe them.
 *
 * <p>Every write runs in its own REQUIRES_NEW transaction that first locks the thread row, so per-thread seq allocation
 * is serial and a message snapshot read under the same lock is always consistent with {@code lastSeq}. Events are
 * broadcast to live subscribers only after that transaction committed (§对话事件协议: never publish before persisting).
 * Callers must not hold the thread row lock in an outer transaction when calling in (that would self-deadlock).
 */
@Service
public class StudioDialogueStore implements StudioDialogueEvents {
    private final IpDialogueThreadRepository threads;
    private final IpDialogueMessageRepository messages;
    private final IpDialogueEventRepository events;
    private final StudioDialogueEventHub hub;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;

    public StudioDialogueStore(IpDialogueThreadRepository threads, IpDialogueMessageRepository messages, IpDialogueEventRepository events,
                               StudioDialogueEventHub hub, ObjectMapper mapper, PlatformTransactionManager manager) {
        this.threads = threads; this.messages = messages; this.events = events; this.hub = hub; this.mapper = mapper;
        this.tx = new TransactionTemplate(manager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** One event to append inside a {@link #write} mutation. */
    public record Pending(String turnId, String runId, String executionId, String type, JsonNode data) {}

    /** Mutation applied under the thread lock; returns the events that describe it (possibly empty). */
    public interface Mutation { List<Pending> apply(IpDialogueThread lockedThread); }

    public List<Event> write(String threadId, Mutation mutation) {
        List<Event> written = tx.execute(status -> {
            IpDialogueThread thread = threads.lockById(threadId).orElseThrow(() -> new IllegalStateException("thread missing " + threadId));
            List<Pending> pending = mutation.apply(thread);
            List<Event> out = new ArrayList<>();
            Instant now = Instant.now();
            if (pending != null) for (Pending p : pending) {
                long seq = thread.getLastSeq() + 1;
                thread.setLastSeq(seq);
                String data = json(p.data());
                var row = IpDialogueEvent.builder().id("IDE-" + uuid20()).threadId(threadId).seq(seq).turnId(p.turnId())
                        .runId(p.runId()).executionId(p.executionId()).type(p.type()).dataJson(data).createdAt(now).build();
                events.save(row);
                out.add(toDto(row));
            }
            thread.setUpdatedAt(now);
            threads.save(thread);
            return out;
        });
        if (written != null) written.forEach(hub::broadcast);
        return written == null ? List.of() : written;
    }

    /**
     * Append events inside the caller's transaction, which must already hold the thread row lock (used where another lock
     * — the parent run's settlement lock — has to be taken first). Broadcast the result with {@link #broadcast} only
     * after that transaction committed.
     */
    public List<Event> appendLocked(IpDialogueThread lockedThread, List<Pending> pending) {
        List<Event> out = new ArrayList<>();
        Instant now = Instant.now();
        for (Pending p : pending) {
            long seq = lockedThread.getLastSeq() + 1;
            lockedThread.setLastSeq(seq);
            var row = IpDialogueEvent.builder().id("IDE-" + uuid20()).threadId(lockedThread.getId()).seq(seq).turnId(p.turnId())
                    .runId(p.runId()).executionId(p.executionId()).type(p.type()).dataJson(json(p.data())).createdAt(now).build();
            events.save(row);
            out.add(toDto(row));
        }
        lockedThread.setUpdatedAt(now);
        threads.save(lockedThread);
        return out;
    }

    public void broadcast(List<Event> written) { if (written != null) written.forEach(hub::broadcast); }

    /** Next message seq on a locked thread. */
    public static long nextMessageSeq(IpDialogueThread lockedThread) {
        long seq = lockedThread.getMessageSeq() + 1;
        lockedThread.setMessageSeq(seq);
        return seq;
    }

    /**
     * {@link StudioDialogueEvents} for the plan executor: persist one event on the thread and broadcast it after commit.
     * Call only after the state it describes is durably saved (e.g. from an afterCommit callback).
     */
    @Override
    public long publish(String threadId, String turnId, String runId, String executionId, String type, JsonNode data) {
        if (!StudioDialogueEventTypes.ALL.contains(type)) throw new IllegalArgumentException("Unknown dialogue event type " + type);
        var written = write(threadId, t -> List.of(new Pending(turnId, runId, executionId, type, data == null ? mapper.createObjectNode() : data)));
        return written.get(0).seq();
    }

    // ── Message helpers used inside mutations (thread lock held by the caller) ─────────────────────────────────────

    public IpDialogueMessage message(String id) { return messages.findById(id).orElseThrow(() -> new IllegalStateException("message missing " + id)); }

    public ArrayNode blocks(IpDialogueMessage message) {
        try {
            JsonNode node = message.getBlocksJson() == null ? null : mapper.readTree(message.getBlocksJson());
            return node instanceof ArrayNode array ? array : mapper.createArrayNode();
        } catch (Exception e) { return mapper.createArrayNode(); }
    }

    public void saveBlocks(IpDialogueMessage message, ArrayNode blocks) {
        message.setBlocksJson(json(blocks)); message.setUpdatedAt(Instant.now()); messages.save(message);
    }

    /** First block of {@code type} whose {@code idField} equals {@code id}, or null. */
    public static ObjectNode findBlock(ArrayNode blocks, String type, String idField, String id) {
        for (JsonNode b : blocks) if (type.equals(b.path("type").asText()) && id.equals(b.path(idField).asText()) && b instanceof ObjectNode o) return o;
        return null;
    }

    public Event toDto(IpDialogueEvent row) {
        JsonNode data;
        try { data = mapper.readTree(row.getDataJson()); } catch (Exception e) { data = mapper.createObjectNode(); }
        String turn = row.getTurnId() != null ? row.getTurnId() : row.getExecutionId() != null ? row.getExecutionId() : "";
        return new StudioDialogueDtos.Event(row.getId(), row.getSeq(), row.getThreadId(), turn, row.getRunId(), row.getExecutionId(),
                row.getCreatedAt().toString(), row.getType(), data);
    }

    String json(Object value) {
        try { return mapper.writeValueAsString(value); } catch (Exception e) { throw new IllegalStateException(e); }
    }

    static String uuid20() { return UUID.randomUUID().toString().replace("-", "").substring(0, 20); }
}
