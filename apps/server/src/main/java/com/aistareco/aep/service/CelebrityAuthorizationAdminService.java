package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminCelebrityAuthorizationDto;
import com.aistareco.aep.dto.AdminCelebrityAuthorizationTransitionDto;
import com.aistareco.aep.dto.AdminCelebrityAuthorizationUpsertDto;
import com.aistareco.aep.model.CelebrityAuthStatus;
import com.aistareco.aep.model.CelebrityStarAuthorization;
import com.aistareco.aep.repository.CelebrityStarAuthorizationRepository;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * 授权关系（用户 × 明星）的 admin 写操作 + 状态机。
 *
 * 状态流转白名单（与 plan §D3 对齐）：
 *   UNAUTHORIZED → PENDING
 *   PENDING      → AUTHORIZED  | UNAUTHORIZED
 *   AUTHORIZED   → EXPIRED
 *   EXPIRED      → PENDING
 *
 * 非法跳转抛 400 ILLEGAL_TRANSITION。
 */
@Service
@Transactional
public class CelebrityAuthorizationAdminService {

    private static final Map<CelebrityAuthStatus, Set<CelebrityAuthStatus>> ALLOWED = Map.of(
            CelebrityAuthStatus.UNAUTHORIZED, Set.of(CelebrityAuthStatus.PENDING),
            CelebrityAuthStatus.PENDING,      Set.of(CelebrityAuthStatus.AUTHORIZED, CelebrityAuthStatus.UNAUTHORIZED),
            CelebrityAuthStatus.AUTHORIZED,   Set.of(CelebrityAuthStatus.EXPIRED),
            CelebrityAuthStatus.EXPIRED,      Set.of(CelebrityAuthStatus.PENDING)
    );

    private final CelebrityStarAuthorizationRepository authRepo;

    public CelebrityAuthorizationAdminService(CelebrityStarAuthorizationRepository authRepo) {
        this.authRepo = authRepo;
    }

    public List<AdminCelebrityAuthorizationDto> list(String userId, String starId, String status) {
        // 简单内存过滤（数据量小；后续按需要再加 Spec 化分页）
        List<CelebrityStarAuthorization> rows = authRepo.findAll();
        if (userId != null && !userId.isBlank()) {
            rows = rows.stream().filter(a -> userId.equals(a.getUserId())).toList();
        }
        if (starId != null && !starId.isBlank()) {
            rows = rows.stream().filter(a -> starId.equals(a.getStarId())).toList();
        }
        if (status != null && !status.isBlank()) {
            CelebrityAuthStatus s = CelebrityAuthStatus.fromWire(status);
            rows = rows.stream().filter(a -> a.getStatus() == s).toList();
        }
        return rows.stream().map(AdminCelebrityAuthorizationDto::from).toList();
    }

    public AdminCelebrityAuthorizationDto get(String id) {
        return AdminCelebrityAuthorizationDto.from(load(id));
    }

    public AdminCelebrityAuthorizationDto create(AdminCelebrityAuthorizationUpsertDto req) {
        if (req == null || req.userId() == null || req.userId().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "AUTH_USER_REQUIRED", "userId 必填");
        }
        if (req.starId() == null || req.starId().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "AUTH_STAR_REQUIRED", "starId 必填");
        }
        // 唯一约束：(userId, starId)
        if (authRepo.findByUserIdAndStarId(req.userId(), req.starId()).isPresent()) {
            throw new BusinessException(HttpStatus.CONFLICT, "AUTH_DUPLICATE",
                    "用户 " + req.userId() + " 已对明星 " + req.starId() + " 有授权关系，请改用 PUT");
        }
        CelebrityStarAuthorization entity = applyUpsert(new CelebrityStarAuthorization(), req);
        entity.setId("auth-" + UUID.randomUUID().toString().substring(0, 12));
        Instant now = Instant.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return AdminCelebrityAuthorizationDto.from(authRepo.save(entity));
    }

    public AdminCelebrityAuthorizationDto update(String id, AdminCelebrityAuthorizationUpsertDto req) {
        CelebrityStarAuthorization entity = load(id);
        applyUpsert(entity, req);
        entity.setUpdatedAt(Instant.now());
        return AdminCelebrityAuthorizationDto.from(authRepo.save(entity));
    }

    public void delete(String id) {
        if (!authRepo.existsById(id)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "AUTH_NOT_FOUND", "授权关系不存在");
        }
        authRepo.deleteById(id);
    }

    /** POST /{id}/transition：状态机校验。 */
    public AdminCelebrityAuthorizationDto transition(String id, AdminCelebrityAuthorizationTransitionDto req,
                                                      String operatorUserId) {
        if (req == null || req.to() == null || req.to().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "TRANSITION_TO_REQUIRED", "to 必填");
        }
        if (req.reason() == null || req.reason().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "TRANSITION_REASON_REQUIRED",
                    "reason 必填（写入审计日志）");
        }
        CelebrityStarAuthorization entity = load(id);
        CelebrityAuthStatus from = entity.getStatus();
        CelebrityAuthStatus to = CelebrityAuthStatus.fromWire(req.to());
        Set<CelebrityAuthStatus> allowed = ALLOWED.getOrDefault(from, Set.of());
        if (!allowed.contains(to)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ILLEGAL_TRANSITION",
                    "非法状态跳转：" + from.wire() + " → " + to.wire()
                            + "（合法目标：" + allowed.stream().map(CelebrityAuthStatus::wire).toList() + "）");
        }
        entity.setStatus(to);
        // 副作用：进 PENDING 时清空 expireDate；进 AUTHORIZED 不动 expireDate（运营自行设）；进 EXPIRED 同
        if (to == CelebrityAuthStatus.PENDING) {
            entity.setPendingNote("运营推进至审核中（" + req.reason() + "）");
        } else if (to == CelebrityAuthStatus.AUTHORIZED) {
            entity.setPendingNote(null);
        } else if (to == CelebrityAuthStatus.UNAUTHORIZED) {
            entity.setScenes(new ArrayList<>());
            entity.setExpireDate(null);
            entity.setPendingNote(null);
        }
        entity.setUpdatedAt(Instant.now());
        // TODO: 写 AuditLog（who=operatorUserId, before=from.wire(), after=to.wire(), reason）
        return AdminCelebrityAuthorizationDto.from(authRepo.save(entity));
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    private CelebrityStarAuthorization load(String id) {
        return authRepo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "AUTH_NOT_FOUND", "授权关系不存在"));
    }

    private CelebrityStarAuthorization applyUpsert(CelebrityStarAuthorization entity,
                                                    AdminCelebrityAuthorizationUpsertDto req) {
        if (req.userId() != null) entity.setUserId(req.userId());
        if (req.starId() != null) entity.setStarId(req.starId());
        if (req.status() != null) entity.setStatus(CelebrityAuthStatus.fromWire(req.status()));
        if (req.scenes() != null) entity.setScenes(new ArrayList<>(req.scenes()));
        if (req.expireDate() != null) entity.setExpireDate(req.expireDate());
        if (req.availableStyles() != null) entity.setAvailableStyles(req.availableStyles());
        if (req.pendingNote() != null) entity.setPendingNote(req.pendingNote());
        if (req.applyUrl() != null) entity.setApplyUrl(req.applyUrl());
        if (entity.getStatus() == null) entity.setStatus(CelebrityAuthStatus.PENDING);
        if (entity.getAvailableStyles() == null) entity.setAvailableStyles(0);
        return entity;
    }
}
