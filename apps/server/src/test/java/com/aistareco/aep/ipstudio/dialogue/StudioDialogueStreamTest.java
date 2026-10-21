package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.Event;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** SSE session ordering: persisted replay after the cursor, buffered live events deduplicated by seq, gaps filled from the store. */
class StudioDialogueStreamTest {
    private final IpDialogueEventRepository events = mock(IpDialogueEventRepository.class);
    private final List<IpDialogueEvent> rows = new ArrayList<>();

    private IpDialogueEvent row(long seq) {
        return IpDialogueEvent.builder().id("e" + seq).threadId("T").seq(seq).turnId("TRN").type("message.delta").dataJson("{\"delta\":\"" + seq + "\"}").createdAt(Instant.now()).build();
    }

    @Test void replaysAfterTheCursorThenLiveInSeqOrderWithoutDuplicatesOrGaps() throws Exception {
        for (long s = 1; s <= 4; s++) rows.add(row(s));
        when(events.findByThreadIdAndSeqGreaterThanOrderBySeqAsc(eq("T"), anyLong(), any(Pageable.class)))
                .thenAnswer(i -> rows.stream().filter(r -> r.getSeq() > (long) i.getArgument(1)).toList());
        var store = new StudioDialogueStore(mock(IpDialogueThreadRepository.class), mock(IpDialogueMessageRepository.class), events,
                new StudioDialogueEventHub(), new ObjectMapper(), mock(PlatformTransactionManager.class));
        var stream = new StudioDialogueStream(mock(StudioDialogueService.class), events, new StudioDialogueEventHub(), store);
        List<String> sent = new ArrayList<>();
        SseEmitter emitter = new SseEmitter() {
            @Override public void send(SseEventBuilder builder) {
                for (var part : builder.build()) if (part.getData() instanceof String text && text.startsWith("id:")) sent.add(text.substring(3, text.indexOf('\n')).strip());
            }
        };
        var session = stream.session("T", emitter, 1);
        session.live(store.toDto(row(3)));          // arrives during replay: buffered, then deduplicated
        session.replay();                            // cursor 1 → sends 2, 3, 4
        Event five = store.toDto(row(5));
        rows.add(row(5));
        rows.add(row(6));
        session.live(store.toDto(row(6)));          // 5 was committed but not seen live yet: filled from the store first
        session.live(five);                          // already sent: dropped
        assertEquals(List.of("2", "3", "4", "5", "6"), sent);
    }

    /**
     * 2026-10-20: switching or starting a conversation closes the old stream; the next write fails with a broken pipe. The
     * session must close itself and leave the hub at once (not keep a dead subscriber and a heartbeat for 30 minutes).
     */
    @Test void aWriteToAGoneClientClosesTheSessionAndLeavesTheHub() throws Exception {
        when(events.findByThreadIdAndSeqGreaterThanOrderBySeqAsc(eq("T"), anyLong(), any(Pageable.class))).thenReturn(List.of());
        var hub = new StudioDialogueEventHub();
        var store = new StudioDialogueStore(mock(IpDialogueThreadRepository.class), mock(IpDialogueMessageRepository.class), events,
                hub, new ObjectMapper(), mock(PlatformTransactionManager.class));
        var service = mock(StudioDialogueService.class);
        when(service.requireThread("u1", "P1", "T")).thenReturn(IpDialogueThread.builder().id("T").lastSeq(0).build());
        int[] attempts = {0};
        SseEmitter gone = new SseEmitter() {
            @Override public void send(SseEventBuilder builder) throws java.io.IOException { attempts[0]++; throw new java.io.IOException("Broken pipe"); }
        };
        StudioDialogueStream[] holder = new StudioDialogueStream[1];
        holder[0] = new StudioDialogueStream(service, events, hub, store) {
            @Override Session session(String threadId, SseEmitter emitter, long cursor) { return holder[0].new Session(threadId, gone, cursor); }
        };
        holder[0].open("u1", "P1", "T", 0L, null);
        assertEquals(1, hub.subscriberCount("T"));
        hub.broadcast(store.toDto(row(1)));
        for (int i = 0; i < 200 && hub.subscriberCount("T") > 0; i++) Thread.sleep(10); // the replay runs on its own thread
        assertEquals(0, hub.subscriberCount("T"), "a gone client leaves the hub right away");
        hub.broadcast(store.toDto(row(2)));
        assertEquals(1, attempts[0], "nothing more is written to a closed session");
    }
}
