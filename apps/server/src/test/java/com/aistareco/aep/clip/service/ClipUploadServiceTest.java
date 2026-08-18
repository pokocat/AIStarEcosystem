package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipRequests.CreateCloneUpload;
import com.aistareco.aep.clip.dto.ClipRequests.SubmitCloneUpload;
import com.aistareco.aep.clip.model.ClipUploadSession;
import com.aistareco.aep.clip.repository.ClipUploadSessionRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ClipUploadServiceTest {
    private ClipUploadSessionRepository sessions;
    private FileStorageService storage;
    private ClipCapturePolicy capturePolicy;
    private ClipUploadWorker worker;
    private ClipUploadService service;

    @BeforeEach
    void setUp() {
        sessions = mock(ClipUploadSessionRepository.class);
        storage = mock(FileStorageService.class);
        capturePolicy = mock(ClipCapturePolicy.class);
        worker = mock(ClipUploadWorker.class);
        service = new ClipUploadService(sessions, storage, capturePolicy, worker);
        when(sessions.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(sessions.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void issueCompleteAndSubmitReuseOneSessionAndOneObject() throws Exception {
        when(sessions.findByExternalOwnerIdAndClientRequestId("owner-1", "clone:req-1234"))
                .thenReturn(Optional.empty());
        when(storage.allocateKey("clip/clone/avatar", "owner-1", "face.mp4"))
                .thenReturn("clip/clone/avatar/owner-1/object.mp4");
        when(storage.browserUpload(anyString(), eq("video/mp4"), eq(1234L), eq(1234L), any()))
                .thenReturn(new CdnUploader.BrowserUploadTicket("https://bucket.example", Map.of("key", "object"), Instant.now().plusSeconds(300)));

        var ticket = service.issue("owner-1", new CreateCloneUpload("avatar", "clone:req-1234", "face.mp4", "video/mp4", 1234L));
        assertEquals("issued", ticket.status());
        assertEquals("https://bucket.example", ticket.uploadUrl());
        ArgumentCaptor<ClipUploadSession> createdCaptor = ArgumentCaptor.forClass(ClipUploadSession.class);
        verify(sessions).saveAndFlush(createdCaptor.capture());
        ClipUploadSession row = createdCaptor.getValue();
        assertEquals("clip/clone/avatar/owner-1/object.mp4", row.getObjectKey());

        when(sessions.findByIdAndExternalOwnerId(row.getId(), "owner-1")).thenReturn(Optional.of(row));
        when(storage.stat(row.getObjectKey())).thenReturn(new CdnUploader.ObjectInfo(1234L, "video/mp4", "etag"));
        assertEquals("uploaded", service.complete("owner-1", row.getId()).status());

        var submitted = service.submit("owner-1", row.getId(), new SubmitCloneUpload("clone:req-1234", "", "", "我的分身", "video"));
        assertEquals("processing", submitted.status());
        verify(worker, times(1)).process(row.getId(), "", "", "我的分身", "video");
        verify(storage, times(1)).stat(row.getObjectKey());
    }

    @Test
    void repeatedIssueReturnsExistingTerminalSessionWithoutAnotherUploadTicket() {
        ClipUploadSession row = ClipUploadSession.builder()
                .id("CU-existing").externalOwnerId("owner-1").clientRequestId("clone:req-1234")
                .kind("voice").objectKey("clip/clone/voice/one.mp3").originalFilename("one.mp3")
                .contentType("audio/mpeg").declaredBytes(99).status("processing")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(sessions.findByExternalOwnerIdAndClientRequestId("owner-1", "clone:req-1234"))
                .thenReturn(Optional.of(row));

        var ticket = service.issue("owner-1", new CreateCloneUpload("voice", "clone:req-1234", "one.mp3", "audio/mpeg", 99L));
        assertTrue(ticket.reused());
        assertEquals("processing", ticket.status());
        assertNull(ticket.uploadUrl());
        verify(storage, never()).browserUpload(anyString(), anyString(), anyLong(), anyLong(), any());
    }
}
