package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos.CloneUploadStatusDto;
import com.aistareco.aep.clip.dto.ClipDtos.CloneUploadTicketDto;
import com.aistareco.aep.clip.dto.ClipRequests.CreateCloneUpload;
import com.aistareco.aep.clip.dto.ClipRequests.SubmitCloneUpload;
import com.aistareco.aep.clip.model.ClipUploadSession;
import com.aistareco.aep.clip.repository.ClipUploadSessionRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class ClipUploadService {
    private static final long TICKET_TTL_SECONDS = 10 * 60;
    private final ClipUploadSessionRepository sessions;
    private final FileStorageService storage;
    private final ClipCapturePolicy capturePolicy;
    private final ClipUploadWorker worker;

    public ClipUploadService(ClipUploadSessionRepository sessions, FileStorageService storage,
                             ClipCapturePolicy capturePolicy, ClipUploadWorker worker) {
        this.sessions = sessions; this.storage = storage; this.capturePolicy = capturePolicy; this.worker = worker;
    }

    public CloneUploadTicketDto issue(String owner, CreateCloneUpload request) {
        if (request == null) throw BusinessException.badRequest("CLIP_UPLOAD_REQUEST_INVALID", "缺少上传参数");
        String kind = clean(request.kind());
        String clientRequestId = clean(request.clientRequestId());
        String fileName = safeFileName(request.fileName());
        String contentType = clean(request.contentType()).toLowerCase(java.util.Locale.ROOT);
        long size = request.sizeBytes() == null ? 0 : request.sizeBytes();
        if (!clientRequestId.matches("[A-Za-z0-9:_-]{8,100}")) throw BusinessException.badRequest("CLIENT_REQUEST_ID_REQUIRED", "缺少合法的 clientRequestId");
        capturePolicy.validateDeclaration(kind, fileName, contentType, size);

        ClipUploadSession existing = sessions.findByExternalOwnerIdAndClientRequestId(owner, clientRequestId).orElse(null);
        if (existing != null) {
            assertSame(existing, kind, fileName, contentType, size);
            return ticket(existing, true);
        }
        Instant now = Instant.now();
        ClipUploadSession created = ClipUploadSession.builder()
                .id("CU-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24))
                .externalOwnerId(owner).clientRequestId(clientRequestId).kind(kind)
                .objectKey(storage.allocateKey("clip/clone/" + kind, owner, fileName))
                .originalFilename(fileName).contentType(contentType).declaredBytes(size)
                .status("issued").expiresAt(now.plusSeconds(TICKET_TTL_SECONDS)).createdAt(now).updatedAt(now).build();
        try { sessions.saveAndFlush(created); }
        catch (DataIntegrityViolationException race) {
            ClipUploadSession winner = sessions.findByExternalOwnerIdAndClientRequestId(owner, clientRequestId).orElseThrow(() -> race);
            assertSame(winner, kind, fileName, contentType, size);
            return ticket(winner, true);
        }
        return ticket(created, false);
    }

    public CloneUploadStatusDto complete(String owner, String uploadId) {
        ClipUploadSession session = required(owner, uploadId);
        if (!"issued".equals(session.getStatus())) return dto(session);
        if (session.getExpiresAt() != null && session.getExpiresAt().isBefore(Instant.now())) {
            fail(session, "CLIP_UPLOAD_EXPIRED", "上传凭证已过期，请重新选择文件");
            return dto(session);
        }
        final CdnUploader.ObjectInfo object;
        try { object = storage.stat(session.getObjectKey()); }
        catch (IOException error) { throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "CLIP_UPLOAD_VERIFY_FAILED", "上传结果暂时无法确认，请稍后重试", error.toString()); }
        if (object == null) throw BusinessException.badRequest("CLIP_UPLOAD_NOT_FOUND", "还没有收到上传文件");
        if (object.bytes() != session.getDeclaredBytes()) {
            storage.delete(session.getObjectKey());
            fail(session, "CLIP_UPLOAD_SIZE_MISMATCH", "上传文件大小与选择时不一致，请重新选择");
            return dto(session);
        }
        if (object.contentType() != null && !object.contentType().isBlank()
                && !session.getContentType().equalsIgnoreCase(object.contentType())) {
            storage.delete(session.getObjectKey());
            fail(session, "CLIP_UPLOAD_TYPE_MISMATCH", "上传文件格式与选择时不一致，请重新选择");
            return dto(session);
        }
        session.setStatus("uploaded"); session.setUpdatedAt(Instant.now()); sessions.save(session);
        return dto(session);
    }

    public CloneUploadStatusDto submit(String owner, String uploadId, SubmitCloneUpload request) {
        ClipUploadSession session = required(owner, uploadId);
        if (request == null || !session.getClientRequestId().equals(clean(request.clientRequestId()))) {
            throw new BusinessException(HttpStatus.CONFLICT, "CLIP_UPLOAD_REQUEST_CONFLICT", "上传受理号与本次请求不一致");
        }
        if ("accepted".equals(session.getStatus()) || "processing".equals(session.getStatus()) || "failed".equals(session.getStatus())) return dto(session);
        if (!"uploaded".equals(session.getStatus())) throw new BusinessException(HttpStatus.CONFLICT, "CLIP_UPLOAD_NOT_COMPLETED", "文件还没有上传完成");
        session.setStatus("processing"); session.setUpdatedAt(Instant.now()); sessions.saveAndFlush(session);
        worker.process(session.getId(), clean(request.avatarId()), clean(request.voiceId()), clean(request.name()), clean(request.voiceSource()));
        return dto(session);
    }

    public CloneUploadStatusDto status(String owner, String uploadId) { return dto(required(owner, uploadId)); }

    private CloneUploadTicketDto ticket(ClipUploadSession session, boolean reused) {
        if (!"issued".equals(session.getStatus())) return new CloneUploadTicketDto(session.getId(), null, java.util.Map.of(),
                iso(session.getExpiresAt()), session.getStatus(), reused);
        Instant expires = Instant.now().plusSeconds(TICKET_TTL_SECONDS);
        session.setExpiresAt(expires); session.setUpdatedAt(Instant.now()); sessions.save(session);
        CdnUploader.BrowserUploadTicket ticket;
        try { ticket = storage.browserUpload(session.getObjectKey(), session.getContentType(), session.getDeclaredBytes(), session.getDeclaredBytes(), expires); }
        catch (UnsupportedOperationException | IllegalStateException error) {
            throw BusinessException.wrapped(HttpStatus.SERVICE_UNAVAILABLE, "CLIP_DIRECT_UPLOAD_NOT_CONFIGURED", "上传服务暂未就绪，请稍后再试", error.toString());
        }
        return new CloneUploadTicketDto(session.getId(), ticket.uploadUrl(), ticket.formData(), iso(ticket.expiresAt()), session.getStatus(), reused);
    }

    private ClipUploadSession required(String owner, String uploadId) {
        return sessions.findByIdAndExternalOwnerId(clean(uploadId), owner)
                .orElseThrow(() -> BusinessException.notFound("CLIP_UPLOAD_NOT_FOUND", "上传受理记录不存在"));
    }

    private void assertSame(ClipUploadSession row, String kind, String fileName, String contentType, long size) {
        if (!Objects.equals(row.getKind(), kind) || !Objects.equals(row.getOriginalFilename(), fileName)
                || !Objects.equals(row.getContentType(), contentType) || row.getDeclaredBytes() != size) {
            throw new BusinessException(HttpStatus.CONFLICT, "CLIP_UPLOAD_REQUEST_CONFLICT", "同一请求标识对应了不同文件，请重新选择");
        }
    }

    private void fail(ClipUploadSession row, String code, String message) {
        row.setStatus("failed"); row.setErrorCode(code); row.setErrorMessage(message);
        row.setCompletedAt(Instant.now()); row.setUpdatedAt(Instant.now()); sessions.save(row);
    }

    private CloneUploadStatusDto dto(ClipUploadSession row) {
        String reviewUrl = Set.of("uploaded", "processing", "accepted").contains(row.getStatus())
                ? storage.signedUrl(row.getObjectKey()) : null;
        return new CloneUploadStatusDto(row.getId(), row.getClientRequestId(), row.getKind(), row.getStatus(),
                row.getAvatarId(), row.getVoiceId(), row.getErrorCode(), row.getErrorMessage(), reviewUrl, iso(row.getExpiresAt()), iso(row.getUpdatedAt()));
    }
    private static String clean(String value) { return value == null ? "" : value.trim(); }
    private static String safeFileName(String value) {
        String text = clean(value).replaceAll("[\\r\\n\\\\/]", "_");
        if (text.isBlank() || text.length() > 255) throw BusinessException.badRequest("CLIP_UPLOAD_FILENAME_INVALID", "文件名无效");
        return text;
    }
    private static String iso(Instant value) { return value == null ? null : value.toString(); }
}
