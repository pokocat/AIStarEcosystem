package com.aistareco.aep.ipstudio.dialogue;

import org.springframework.data.domain.PageRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Bounded message reads shared by the service and the turn worker. */
final class DialogueTurnQueries {
    private DialogueTurnQueries() {}

    /** Up to {@code limit} most recent messages with seq < {@code beforeSeq}, in ascending order. */
    static List<IpDialogueMessage> before(IpDialogueMessageRepository repo, String threadId, long beforeSeq, int limit) {
        List<IpDialogueMessage> desc = repo.findByThreadIdAndSeqLessThanOrderBySeqDesc(threadId, beforeSeq, PageRequest.of(0, limit));
        List<IpDialogueMessage> out = new ArrayList<>(desc);
        Collections.reverse(out);
        return out;
    }

    /** Up to {@code limit} most recent messages, newest first. */
    static List<IpDialogueMessage> recent(IpDialogueMessageRepository repo, String threadId, int limit) {
        return repo.findByThreadIdOrderBySeqDesc(threadId, PageRequest.of(0, limit));
    }
}
