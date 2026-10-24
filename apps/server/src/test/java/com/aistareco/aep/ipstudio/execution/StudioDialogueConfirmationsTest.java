package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dialogue.IpDialogueMessage;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueMessageRepository;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueThread;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueThreadRepository;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Plan blocks proposed inside a parent dialogue run are found for confirmation (cards are validated by the dialogue). */
class StudioDialogueConfirmationsTest {
    final ObjectMapper om=new ObjectMapper();
    final Map<String,IpDialogueMessage> messages=new HashMap<>();
    IpProjectService projects;StudioDialogueConfirmations confirmations;

    @BeforeEach void setUp() {
        var messageRepo=mock(IpDialogueMessageRepository.class);var threadRepo=mock(IpDialogueThreadRepository.class);
        when(messageRepo.findById(anyString())).thenAnswer(i->Optional.ofNullable(messages.get((String)i.getArgument(0))));
        when(messageRepo.findByThreadIdOrderBySeqDesc(eq("T1"),any())).thenAnswer(i->messages.values().stream().filter(m->"T1".equals(m.getThreadId()))
                .sorted(Comparator.comparingLong(IpDialogueMessage::getSeq).reversed()).toList());
        when(threadRepo.findById("T1")).thenReturn(Optional.of(IpDialogueThread.builder().id("T1").projectId("p").ownerUserId("u").createdAt(Instant.now()).updatedAt(Instant.now()).build()));
        when(threadRepo.findById("T2")).thenReturn(Optional.of(IpDialogueThread.builder().id("T2").projectId("other").ownerUserId("u").createdAt(Instant.now()).updatedAt(Instant.now()).build()));
        @SuppressWarnings("unchecked") ObjectProvider<IpDialogueMessageRepository> m=mock(ObjectProvider.class);when(m.getIfAvailable()).thenReturn(messageRepo);
        @SuppressWarnings("unchecked") ObjectProvider<IpDialogueThreadRepository> t=mock(ObjectProvider.class);when(t.getIfAvailable()).thenReturn(threadRepo);
        projects=mock(IpProjectService.class);
        confirmations=new StudioDialogueConfirmations(m,t,projects,om);
    }
    void message(String id,String thread,long seq,String role,String blocks) {
        messages.put(id,IpDialogueMessage.builder().id(id).threadId(thread).seq(seq).role(role).blocksJson(blocks).status("done").createdAt(Instant.now()).build());
    }
    @Test void conversationPicksAreTheUserMessagesPicksAndAttachmentsNewestFirst() {
        message("U1","T1",1,"user","[]");messages.get("U1").setPinnedNodeIdsJson("[\"video\",\"sheet\"]");
        message("A1","T1",2,"assistant","[]");messages.get("A1").setPinnedNodeIdsJson("[\"not-a-pick\"]");
        message("U2","T1",3,"user","[]");messages.get("U2").setAttachmentNodeIdsJson("[\"upload\",\"video\"]");
        message("U3","T1",4,"user","[]");
        assertEquals(List.of("upload","video","sheet"),confirmations.conversationPicks("T1"));
        assertEquals(List.of(),confirmations.conversationPicks(null));
    }
    @Test void planBlocksOfAnOwnedParentDialogueRunAreFoundWithTheirSkillSnapshot() throws Exception {
        var input=om.createObjectNode();input.putObject("dialogue").put("threadId","T1");input.putArray("contextNodeIds").add("src");
        input.putObject("_exec").put("assistantMessageId","A9").putObject("skill").put("key","reference-video-recreation").put("version",1);
        when(projects.ownedRun("u","p","IPR-dlg")).thenReturn(Optional.of(IpRun.builder().id("IPR-dlg").inputJson(input.toString()).build()));
        message("A9","T1",9,"assistant","[{\"type\":\"plan\",\"planRunId\":\"IPR-dlg\",\"revision\":4,\"fingerprint\":\"fp\",\"plan\":{\"summary\":\"s\",\"steps\":[]}}]");
        var record=confirmations.find("u","p","IPR-dlg","fp").orElseThrow();
        assertEquals(4,record.revision());assertEquals("T1",record.threadId());assertEquals(List.of("src"),record.contextNodeIds());
        assertEquals("reference-video-recreation",record.skillSnapshot().path("key").asText());
        assertTrue(confirmations.find("u","p","IPR-dlg","other").isEmpty());
        assertTrue(confirmations.find("u","p","IPR-not-mine","fp").isEmpty());
    }
}
