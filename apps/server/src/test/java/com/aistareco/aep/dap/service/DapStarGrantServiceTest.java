package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapStarGrantDto;
import com.aistareco.aep.model.CelebrityAuthStatus;
import com.aistareco.aep.model.CelebrityStar;
import com.aistareco.aep.model.CelebrityStarAuthorization;
import com.aistareco.aep.repository.CelebrityStarAuthorizationRepository;
import com.aistareco.aep.repository.CelebrityStarRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DapStarGrantService（资产中枢 P2 · 明星授权只读投影）：
 * UNAUTHORIZED 不投影 / 排序（生效 → 审批中 → 到期，组内更新时间倒序）/
 * 明星缺档兜底 / 字段映射（pending 无 decidedAt）。
 */
class DapStarGrantServiceTest {

    private static final String USER = "u_merchant";

    private CelebrityStarAuthorizationRepository authRepo;
    private CelebrityStarRepository starRepo;
    private DapStarGrantService service;

    @BeforeEach
    void setUp() {
        authRepo = mock(CelebrityStarAuthorizationRepository.class);
        starRepo = mock(CelebrityStarRepository.class);
        service = new DapStarGrantService(authRepo, starRepo);
    }

    private CelebrityStarAuthorization auth(String id, String starId, CelebrityAuthStatus status, Instant updatedAt) {
        CelebrityStarAuthorization a = new CelebrityStarAuthorization();
        a.setId(id);
        a.setUserId(USER);
        a.setStarId(starId);
        a.setStatus(status);
        a.setCreatedAt(Instant.parse("2026-08-01T00:00:00Z"));
        a.setUpdatedAt(updatedAt);
        return a;
    }

    private CelebrityStar star(String id, String name) {
        CelebrityStar s = new CelebrityStar();
        s.setId(id);
        s.setName(name);
        s.setAvatar("/plaza/" + id + ".jpg");
        s.setCategory("时尚");
        return s;
    }

    @Test
    void unauthorizedRowsAreNotProjected() {
        when(authRepo.findByUserId(USER)).thenReturn(List.of(
                auth("a1", "s1", CelebrityAuthStatus.UNAUTHORIZED, Instant.parse("2026-08-10T00:00:00Z"))));
        assertTrue(service.list(USER).isEmpty());
        verifyNoInteractions(starRepo);
    }

    @Test
    void softDeletedStarGrantsAreDropped() {
        // findByIdInAndDeletedAtIsNull 查不到（明星已软删/不存在）→ 该授权行不投影，
        // 不渲染成「未知明星」的可用授权。
        when(authRepo.findByUserId(USER)).thenReturn(List.of(
                auth("a1", "s-deleted", CelebrityAuthStatus.AUTHORIZED, Instant.parse("2026-08-10T00:00:00Z"))));
        when(starRepo.findByIdInAndDeletedAtIsNull(any())).thenReturn(List.of());
        assertTrue(service.list(USER).isEmpty());
    }

    @Test
    void sortsAuthorizedThenPendingThenExpired_updatedAtDescWithinGroup() {
        CelebrityStarAuthorization expired = auth("a-exp", "s1", CelebrityAuthStatus.EXPIRED, Instant.parse("2026-08-20T00:00:00Z"));
        CelebrityStarAuthorization pendingOld = auth("a-p1", "s2", CelebrityAuthStatus.PENDING, Instant.parse("2026-08-05T00:00:00Z"));
        CelebrityStarAuthorization pendingNew = auth("a-p2", "s3", CelebrityAuthStatus.PENDING, Instant.parse("2026-08-15T00:00:00Z"));
        CelebrityStarAuthorization active = auth("a-act", "s4", CelebrityAuthStatus.AUTHORIZED, Instant.parse("2026-08-01T00:00:00Z"));
        when(authRepo.findByUserId(USER)).thenReturn(List.of(expired, pendingOld, pendingNew, active));
        when(starRepo.findByIdInAndDeletedAtIsNull(any())).thenReturn(List.of(star("s1", "甲"), star("s2", "乙"), star("s3", "丙"), star("s4", "丁")));

        List<String> ids = service.list(USER).stream().map(DapStarGrantDto::id).toList();
        assertEquals(List.of("a-act", "a-p2", "a-p1", "a-exp"), ids);
    }

    @Test
    void mapsFields_pendingHasNoStatusUpdatedAt() {
        CelebrityStarAuthorization a = auth("a1", "s1", CelebrityAuthStatus.PENDING, Instant.parse("2026-08-10T00:00:00Z"));
        a.setScenes(List.of("带货", "种草"));
        when(authRepo.findByUserId(USER)).thenReturn(List.of(a));
        when(starRepo.findByIdInAndDeletedAtIsNull(any())).thenReturn(List.of(star("s1", "苏黎")));

        DapStarGrantDto dto = service.list(USER).get(0);
        assertEquals("pending", dto.status());
        assertEquals(List.of("带货", "种草"), dto.scenes());
        assertNull(dto.statusUpdatedAt());
        assertNull(dto.expireDate());
        assertEquals("苏黎", dto.starName());
        assertEquals("2026-08-01T00:00:00Z", dto.appliedAt());
    }

    @Test
    void nullScenesBecomeEmptyList_andStylesPassThrough() {
        CelebrityStarAuthorization a = auth("a1", "s1", CelebrityAuthStatus.AUTHORIZED, Instant.parse("2026-08-10T00:00:00Z"));
        a.setScenes(null);
        a.setAvailableStyles(4);
        when(authRepo.findByUserId(USER)).thenReturn(List.of(a));
        when(starRepo.findByIdInAndDeletedAtIsNull(any())).thenReturn(List.of(star("s1", "苏黎")));

        DapStarGrantDto dto = service.list(USER).get(0);
        assertEquals(List.of(), dto.scenes());
        assertEquals(4, dto.availableStyles());
    }

    @Test
    void mapsExpireDateForAuthorized() {
        CelebrityStarAuthorization a = auth("a1", "s1", CelebrityAuthStatus.AUTHORIZED, Instant.parse("2026-08-10T00:00:00Z"));
        a.setExpireDate(LocalDate.of(2026, 12, 31));
        when(authRepo.findByUserId(USER)).thenReturn(List.of(a));
        when(starRepo.findByIdInAndDeletedAtIsNull(any())).thenReturn(List.of(star("s1", "苏黎")));

        DapStarGrantDto dto = service.list(USER).get(0);
        assertEquals("authorized", dto.status());
        assertEquals("2026-12-31", dto.expireDate());
        assertNotNull(dto.statusUpdatedAt());
    }
}
