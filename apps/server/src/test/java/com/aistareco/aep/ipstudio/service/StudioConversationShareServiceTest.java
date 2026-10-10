package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpProjectDto;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpUpdateProjectRequest;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StudioConversationShareServiceTest {
    ObjectMapper om=new ObjectMapper();IpProjectService projects;IpConversationShareRepository shares;IpConversationCopyRepository copies;StudioConversationShareService service;IpProject project;JsonNode doc;
    @BeforeEach void setup()throws Exception {
        projects=mock(IpProjectService.class);shares=mock(IpConversationShareRepository.class);copies=mock(IpConversationCopyRepository.class);
        service=new StudioConversationShareService(projects,shares,copies,om);project=IpProject.builder().id("p").ownerUserId("owner").build();
        when(projects.required("owner","p")).thenReturn(project);when(projects.requiredForUpdate("owner","p")).thenReturn(project);
        doc=om.readTree("""
            {"nodes":[{"id":"n","title":"讨论故事","metadata":{"status":"idle","storageKey":"private","studio":{"kind":"assistant","request":{"clientRequestId":"paid-request","model":"private-model"},"conversation":{"mode":"general","turns":[{"role":"user","content":"从角色开始"},{"role":"assistant","content":"先写人物，再写故事"}],"plan":{"summary":"先设定人物","steps":[{"id":"original-id","operation":"image","title":"人物设定","prompt":"画一张人物设定图","referenceNodeIds":["private-node"]}],"questions":[],"raw":"private"}}}}}],"connections":[]}
            """);when(projects.readDoc(project)).thenReturn(doc);
        when(shares.save(any())).thenAnswer(i->i.getArgument(0));
    }
    @Test void previewWhitelistsVisibleTextAndReplacesPrivateBindings() {
        var p=service.preview("owner","p","n");var json=p.snapshot().toString();
        assertFalse(json.contains("private"));assertFalse(json.contains("paid-request"));assertFalse(json.contains("original-id"));
        assertEquals(0,p.snapshot().at("/plan/steps/0/referenceNodeIds").size());assertEquals(1,p.snapshot().at("/plan/steps/0/unresolvedReferences").size());
        assertEquals(64,p.snapshotHash().length());verify(shares,never()).save(any());
    }
    @Test void changingContentAfterApprovalRejectsWithoutCreatingALink() {
        var hash=service.preview("owner","p","n").snapshotHash();((com.fasterxml.jackson.databind.node.ObjectNode)doc.at("/nodes/0/metadata/studio/conversation/turns/1")).put("content","新答案");
        assertThrows(BusinessException.class,()->service.create("owner","p","n",new StudioConversationShareService.CreateRequest(hash)));
        verify(shares,never()).save(any());
    }
    @Test void sameSnapshotReplaysLinkButANewSnapshotRevokesOldLink() {
        var preview=service.preview("owner","p","n");var first=service.create("owner","p","n",new StudioConversationShareService.CreateRequest(preview.snapshotHash()));
        assertTrue(first.token().matches("[A-Za-z0-9_-]{32}"));var stored=stored(first.token(),preview);stored.setCreatedAt(first.createdAt());when(shares.findByProjectIdAndNodeIdAndRevokedAtIsNullOrderByCreatedAtDesc("p","n")).thenReturn(List.of(stored));
        assertEquals(first,service.create("owner","p","n",new StudioConversationShareService.CreateRequest(preview.snapshotHash())));verify(shares,times(1)).save(any());
        ((com.fasterxml.jackson.databind.node.ObjectNode)doc.at("/nodes/0/metadata/studio/conversation/turns/1")).put("content","新答案");
        var next=service.create("owner","p","n",new StudioConversationShareService.CreateRequest(service.preview("owner","p","n").snapshotHash()));
        assertNotEquals(first.token(),next.token());assertNotNull(stored.getRevokedAt());
    }
    @Test void emptyLoadingAndUnfinishedConversationsCannotShare() {
        var metadata=(com.fasterxml.jackson.databind.node.ObjectNode)doc.at("/nodes/0/metadata");metadata.put("status","loading");assertThrows(BusinessException.class,()->service.preview("owner","p","n"));
        metadata.put("status","idle");((com.fasterxml.jackson.databind.node.ObjectNode)doc.at("/nodes/0/metadata/studio/conversation/turns/1")).put("role","user");assertThrows(BusinessException.class,()->service.preview("owner","p","n"));
        verify(shares,never()).save(any());
    }
    @Test void anotherOwnerCannotPreviewOrRevoke() {
        when(projects.required("other","p")).thenThrow(BusinessException.notFound("IP_PROJECT_NOT_FOUND","missing"));
        when(projects.requiredForUpdate("other","p")).thenThrow(BusinessException.notFound("IP_PROJECT_NOT_FOUND","missing"));
        assertThrows(BusinessException.class,()->service.preview("other","p","n"));assertThrows(BusinessException.class,()->service.revoke("other","p","n","token"));verifyNoInteractions(shares);
    }
    @Test void revokeAndSourceDeletionClosePublicRead() {
        var row=stored("a".repeat(32),service.preview("owner","p","n"));when(shares.findById(row.getToken())).thenReturn(Optional.of(row));when(shares.lock(row.getToken())).thenReturn(Optional.of(row));
        assertEquals(2,service.read(row.getToken()).snapshot().path("turns").size());
        service.revoke("owner","p","n",row.getToken());assertThrows(BusinessException.class,()->service.read(row.getToken()));service.revoke("owner","p","n",row.getToken());
        row.setRevokedAt(null);when(projects.required("owner","p")).thenThrow(BusinessException.notFound("IP_PROJECT_NOT_FOUND","missing"));assertThrows(BusinessException.class,()->service.read(row.getToken()));
    }
    @Test void copyingHasNewIdsNoRunOrAssetBindingsAndSameRequestReplaysProject() {
        var row=stored("a".repeat(32),service.preview("owner","p","n"));when(shares.lock(row.getToken())).thenReturn(Optional.of(row));
        var created=new IpProjectDto("new-project","copy",null,"draft",null,null,null,null,"v",om.createObjectNode(),Map.of(),Map.of());when(projects.create(eq("reader"),any())).thenReturn(created);
        var req=new StudioConversationShareService.CopyRequest("request123");assertEquals("new-project",service.copy("reader",row.getToken(),req));
        var update=ArgumentCaptor.forClass(IpUpdateProjectRequest.class);verify(projects).update(eq("reader"),eq("new-project"),update.capture());
        var copied=update.getValue().doc();assertFalse(copied.toString().contains("private"));assertFalse(copied.toString().contains("paid-request"));assertTrue(copied.at("/nodes/0/id").asText().startsWith("conversation-"));
        assertEquals(0,copied.path("connections").size());assertEquals("assistant",copied.at("/nodes/0/metadata/studio/kind").asText());
        assertEquals("assistant",copied.at("/nodes/0/metadata/studioStart").asText());assertTrue(copied.at("/nodes/0/metadata/studio/request").isMissingNode());
        when(copies.findByOwnerUserIdAndClientRequestId("reader","request123")).thenReturn(Optional.of(IpConversationCopy.builder().token(row.getToken()).projectId("new-project").build()));
        when(projects.required("reader","new-project")).thenReturn(project);row.setRevokedAt(Instant.now());assertEquals("new-project",service.copy("reader",row.getToken(),req));verify(projects,times(1)).create(eq("reader"),any());
    }
    private IpConversationShare stored(String token,StudioConversationShareService.Preview p){return IpConversationShare.builder().token(token).ownerUserId("owner").projectId("p").nodeId("n").snapshotHash(p.snapshotHash()).snapshotJson(p.snapshot().toString()).createdAt(Instant.parse("2026-10-08T00:00:00Z")).build();}
}
