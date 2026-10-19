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
}
