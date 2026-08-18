package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.model.ClipUploadSession;
import com.aistareco.aep.clip.repository.ClipUploadSessionRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

/** 独立 bean 保证 @Async 生效；会话先落 processing，客户端立即拿到可查询的受理号。 */
@Service
public class ClipUploadWorker {
    private static final Logger log = LoggerFactory.getLogger(ClipUploadWorker.class);
    private final ClipUploadSessionRepository sessions;
    private final FileStorageService storage;
    private final ClipAvatarService avatars;

    public ClipUploadWorker(ClipUploadSessionRepository sessions, FileStorageService storage, ClipAvatarService avatars) {
        this.sessions = sessions; this.storage = storage; this.avatars = avatars;
    }

    @Async("clipUploadExecutor")
    public void process(String uploadId, String avatarId, String voiceId, String name, String voiceSource) {
        ClipUploadSession session = sessions.findById(uploadId).orElse(null);
        if (session == null || !"processing".equals(session.getStatus())) return;
        try {
            FileStorageService.StoredFile stored = storage.adopt(session.getObjectKey(), session.getDeclaredBytes(), session.getContentType());
            Map<String, Object> result = avatars.cloneStored(session.getExternalOwnerId(), session.getKind(),
                    session.getOriginalFilename(), session.getContentType(), stored, avatarId, voiceId, name, voiceSource);
            session.setAvatarId(text(result.get("avatarId")));
            session.setVoiceId(text(result.get("voiceId")));
            session.setStatus("accepted"); session.setCompletedAt(Instant.now()); session.setUpdatedAt(Instant.now());
            sessions.save(session);
        } catch (RuntimeException error) {
            session.setStatus("failed");
            session.setErrorCode(error instanceof BusinessException be ? be.getCode() : "CLIP_CLONE_SUBMIT_FAILED");
            session.setErrorMessage(error.getMessage() == null ? "训练受理失败，请重试" : error.getMessage());
            session.setCompletedAt(Instant.now()); session.setUpdatedAt(Instant.now()); sessions.save(session);
            storage.delete(session.getObjectKey());
            log.warn("[clip-upload] process failed uploadId={} owner={} code={}: {}", uploadId,
                    session.getExternalOwnerId(), session.getErrorCode(), error.getMessage());
        }
    }

    private static String text(Object value) {
        String text = value == null ? null : String.valueOf(value).trim();
        return text == null || text.isBlank() ? null : text;
    }
}
