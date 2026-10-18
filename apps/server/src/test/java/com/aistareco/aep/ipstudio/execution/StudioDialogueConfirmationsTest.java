package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueMessage;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueMessageRepository;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueThread;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueThreadRepository;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Confirmation is the clicked approval card (or an approving user message) for exactly this plan fingerprint. */
class StudioDialogueConfirmationsTest {
    final ObjectMapper om=new ObjectMapper();
    final Map<String,IpDialogueMessage> messages=new HashMap<>();
    IpProjectService projects;StudioDialogueConfirmations confirmations;
    final BillingSelection personal=new BillingSelection("personal",null);

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
    String card(String fingerprint,String status,String expires) {
        return "[{\"type\":\"approval\",\"approvalId\":\"APV-1\",\"stage\":\"production\",\"planFingerprint\":\""+fingerprint+"\",\"status\":\""+status+"\""
                +(expires==null?"":",\"expiresAt\":\""+expires+"\"")+",\"billingSelection\":{\"mode\":\"personal\"}}]";
    }

    @Test void theClickedCardMustNameThisFingerprintStageAndPayer() {
        message("A1","T1",2,"assistant",card("fp-new","pending",Instant.now().plusSeconds(600).toString()));
        var card=confirmations.requireConfirmation("u","p","A1","production","fp-new","APV-1",personal);
        assertEquals("T1",card.path("threadId").asText());assertEquals("A1",card.path("messageId").asText());assertEquals("APV-1",card.path("approvalId").asText());
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->confirmations.requireConfirmation("u","p","A1","production","fp-old",null,personal)).getCode(),"an old card never approves a new revision");
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->confirmations.requireConfirmation("u","p","A1","analysis","fp-new",null,personal)).getCode());
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->confirmations.requireConfirmation("u","p","A1","production","fp-new","APV-other",personal)).getCode());
        assertEquals("BILLING_SELECTION_CONFLICT",assertThrows(BusinessException.class,()->confirmations.requireConfirmation("u","p","A1","production","fp-new",null,new BillingSelection("enterprise","e1"))).getCode());
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->confirmations.requireConfirmation("u","other","A1","production","fp-new",null,personal)).getCode());
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->confirmations.requireConfirmation("u","p","missing","production","fp-new",null,personal)).getCode());
    }

    @Test void expiredOrSupersededCardsAreRefusedAndAnApprovingUserMessageFindsTheCard() {
        message("A1","T1",2,"assistant",card("fp","pending",Instant.now().minusSeconds(5).toString()));
        assertThrows(BusinessException.class,()->confirmations.requireConfirmation("u","p","A1","production","fp",null,personal));
        message("A2","T1",3,"assistant",card("fp2","superseded",null));
        assertThrows(BusinessException.class,()->confirmations.requireConfirmation("u","p","A2","production","fp2",null,personal));
        message("A3","T1",4,"assistant",card("fp3","pending",null));
        message("U1","T1",5,"user","[]");
        var answered=confirmations.requireConfirmation("u","p","U1","production","fp3",null,personal);
        assertEquals("A3",answered.path("messageId").asText(),"「按你推荐的做」 binds to the card for this fingerprint");
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
