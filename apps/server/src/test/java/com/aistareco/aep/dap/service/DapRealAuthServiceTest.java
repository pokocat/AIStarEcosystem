package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.dto.DapDtos.RealAuthSessionDto;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.aep.dap.service.modelink.HttpModelinkGateway;
import com.aistareco.aep.dap.service.modelink.MockModelinkGateway;
import com.aistareco.aep.dap.service.modelink.ModelinkGateway.GroupState;
import com.aistareco.aep.dap.service.modelink.ModelinkService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DapRealAuthService（v0.105 真人授权 · 刷脸认证链路）：
 * 建会话 / 幂等复用 / h5 链接下发 / 回调幂等 / 失败收敛 / 未配置且禁 mock 时 503 不落行。
 */
class DapRealAuthServiceTest {

    private static final String USER = "u_owner";

    private Map<String, DapMaterialGroup> groups;
    private Map<String, DapCapture> captures;
    private DapMaterialGroupRepository groupRepo;
    private DapCaptureRepository captureRepo;
    private ModelinkService modelink;
    private DapProperties props;
    private DapRealAuthService svc;

    @BeforeEach
    void setUp() {
        groups = new HashMap<>();
        captures = new HashMap<>();

        groupRepo = mock(DapMaterialGroupRepository.class);
        when(groupRepo.save(any())).thenAnswer(inv -> {
            DapMaterialGroup g = inv.getArgument(0);
            groups.put(g.getId(), g);
            return g;
        });
        when(groupRepo.saveAndFlush(any())).thenAnswer(inv -> {
            DapMaterialGroup g = inv.getArgument(0);
            groups.put(g.getId(), g);
            return g;
        });
        when(groupRepo.existsById(anyString())).thenAnswer(inv -> groups.containsKey(inv.getArgument(0, String.class)));
        when(groupRepo.findByIdAndOwnerUserId(anyString(), anyString())).thenAnswer(inv -> {
            DapMaterialGroup g = groups.get(inv.getArgument(0, String.class));
            return Optional.ofNullable(g != null && inv.getArgument(1, String.class).equals(g.getOwnerUserId()) ? g : null);
        });
        when(groupRepo.findByCallbackToken(anyString())).thenAnswer(inv -> groups.values().stream()
                .filter(g -> inv.getArgument(0, String.class).equals(g.getCallbackToken())).findFirst());

        captureRepo = mock(DapCaptureRepository.class);
        when(captureRepo.save(any())).thenAnswer(inv -> {
            DapCapture c = inv.getArgument(0);
            captures.put(c.getId(), c);
            return c;
        });
        when(captureRepo.findByIdAndOwnerUserId(anyString(), anyString())).thenAnswer(inv -> {
            DapCapture c = captures.get(inv.getArgument(0, String.class));
            return Optional.ofNullable(c != null && inv.getArgument(1, String.class).equals(c.getOwnerUserId()) ? c : null);
        });

        modelink = mock(ModelinkService.class);
        when(modelink.boundModel()).thenReturn("bytedance/doubao-seedance-2-0-260128");
        when(modelink.isMockMode()).thenReturn(false);

        props = new DapProperties();
        props.getModelink().setCallbackBaseUrl("https://aiavatar.example.cn");
        svc = new DapRealAuthService(groupRepo, captureRepo, modelink, props, new DapSupport());

        captures.put("CAP-1", DapCapture.builder().id("CAP-1").ownerUserId(USER).avatarId("DH-1")
                .status("footage_uploaded").footageKey("dap/capture/u/a.webm")
                .footageContentType("video/webm").frameKey("dap/capture/u/a.png")
                .createdAt(Instant.now()).build());
    }

    private void stubCreate(String qgroupid) {
        when(modelink.createGroup(eq("liveness_face"), anyString(), anyString(), anyString()))
                .thenReturn(new GroupState(qgroupid, "pending", null, null, null));
    }

    @Test
    void startCreatesGroupAndBindsCapture() {
        stubCreate("qg-1");
        RealAuthSessionDto dto = svc.start(USER, "CAP-1");

        assertEquals("preparing", dto.status());
        assertEquals("CAP-1", dto.captureId());
        assertEquals("DH-1", dto.avatarId());
        assertNull(dto.h5Url(), "preparing 阶段还没有刷脸页");
        assertFalse(dto.mock());

        DapMaterialGroup g = groups.get(dto.id());
        assertNotNull(g);
        assertEquals("qg-1", g.getQgroupid());
        assertEquals("liveness_face", g.getKind());
        assertNotNull(g.getCallbackToken());
        assertEquals(g.getId(), captures.get("CAP-1").getAuthGroupId());

        // callback_url 带不可枚举 state，且指向我们的 permitAll 回跳端点
        verify(modelink).createGroup(eq("liveness_face"), anyString(), anyString(),
                eq("https://aiavatar.example.cn/api/v1/real-auth/callback?state=" + g.getCallbackToken()));
    }

    @Test
    void startIsIdempotentForSameCapture() {
        stubCreate("qg-1");
        RealAuthSessionDto first = svc.start(USER, "CAP-1");
        when(modelink.getGroup("qg-1")).thenReturn(new GroupState("qg-1", "awaiting_auth", "https://face/h5", "bt-1", null));

        RealAuthSessionDto again = svc.start(USER, "CAP-1");

        assertEquals(first.id(), again.id());
        assertEquals(1, groups.size());
        verify(modelink, times(1)).createGroup(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void getSessionExposesH5LinkWhenAwaitingAuth() {
        stubCreate("qg-1");
        RealAuthSessionDto created = svc.start(USER, "CAP-1");
        when(modelink.getGroup("qg-1")).thenReturn(new GroupState("qg-1", "awaiting_auth", "https://face/h5", "bt-1", null));

        RealAuthSessionDto dto = svc.getSession(USER, created.id());

        assertEquals("awaiting_auth", dto.status());
        assertEquals("https://face/h5", dto.h5Url());
        assertEquals("bt-1", groups.get(created.id()).getBytedToken(), "一次性凭证落库供回调兜底");
    }

    @Test
    void callbackForwardsOnceThenIsIdempotent() {
        stubCreate("qg-1");
        RealAuthSessionDto created = svc.start(USER, "CAP-1");
        String token = groups.get(created.id()).getCallbackToken();

        String html = svc.handleCallback(token, "10000", "bt-cb");
        assertTrue(html.contains("认证已提交"));
        assertEquals("validating", groups.get(created.id()).getStatus());
        assertNotNull(groups.get(created.id()).getValidateCalledAt());

        // 重复回跳（用户刷新落地页）→ 绝不二次消耗一次性凭证
        svc.handleCallback(token, "10000", "bt-cb");
        svc.handleCallback(token, "10000", "bt-cb");
        verify(modelink, times(1)).visualValidate(eq("qg-1"), eq("10000"), eq("bt-cb"));
    }

    @Test
    void callbackWithNonSuccessCodeConvergesToFailed() {
        stubCreate("qg-1");
        RealAuthSessionDto created = svc.start(USER, "CAP-1");
        String token = groups.get(created.id()).getCallbackToken();

        String html = svc.handleCallback(token, "10001", null);
        assertTrue(html.contains("认证未通过"));
        // 非 10000 也照实透传（平台据此判 failed，不消耗有效凭证）
        verify(modelink).visualValidate(eq("qg-1"), eq("10001"), any());
        assertEquals("validating", groups.get(created.id()).getStatus());

        // 生效与否只认服务端拉到的远端状态
        when(modelink.getGroup("qg-1")).thenReturn(new GroupState("qg-1", "failed", null, null, "刷脸未通过"));
        RealAuthSessionDto dto = svc.getSession(USER, created.id());
        assertEquals("failed", dto.status());
        assertEquals("刷脸未通过", dto.failReason());
    }

    @Test
    void callbackForwardFailureKillsSessionInsteadOfHangingInValidating() {
        stubCreate("qg-1");
        RealAuthSessionDto created = svc.start(USER, "CAP-1");
        String token = groups.get(created.id()).getCallbackToken();
        doThrow(new RuntimeException("上游 502")).when(modelink).visualValidate(anyString(), anyString(), any());

        String html = svc.handleCallback(token, "10000", "bt-cb");

        // 回传没到上游 → 远端会永远停在 awaiting_auth，若留 validating 就会被
        // holdValidating 永久 hold（用户卡「核验中」+ 轮询器空转死行），故当场判终态
        DapMaterialGroup g = groups.get(created.id());
        assertEquals("failed", g.getStatus());
        assertTrue(g.getFailReason().contains("回传失败"), "保留可排障的失败原因：" + g.getFailReason());
        assertTrue(html.contains("认证提交失败"), "落地页必须是失败语义：" + html);
        assertFalse(html.contains("正在确认你的授权"), "不得被成功路径文案覆盖");

        // 终态 → 轮询器 / getSession 不再打上游
        svc.getSession(USER, created.id());
        verify(modelink, never()).getGroup(anyString());

        // 且可以重新发起：failed 会话不复用，另建新分组拿新的一次性凭证
        reset(modelink);
        when(modelink.boundModel()).thenReturn("m1");
        when(modelink.createGroup(eq("liveness_face"), anyString(), anyString(), anyString()))
                .thenReturn(new GroupState("qg-2", "pending", null, null, null));
        RealAuthSessionDto retry = svc.start(USER, "CAP-1");
        assertNotEquals(created.id(), retry.id());
        assertEquals("preparing", retry.status());
        assertNotEquals(token, groups.get(retry.id()).getCallbackToken());
    }

    @Test
    void validatingHoldsUntilRemoteDecides() {
        stubCreate("qg-1");
        RealAuthSessionDto created = svc.start(USER, "CAP-1");
        svc.handleCallback(groups.get(created.id()).getCallbackToken(), "10000", "bt");

        // 平台判定期间远端仍是 awaiting_auth —— 不能倒退回「等用户刷脸」
        when(modelink.getGroup("qg-1")).thenReturn(new GroupState("qg-1", "awaiting_auth", "https://face/h5", "bt", null));
        assertEquals("validating", svc.getSession(USER, created.id()).status());

        when(modelink.getGroup("qg-1")).thenReturn(new GroupState("qg-1", "active", null, null, null));
        assertEquals("active", svc.getSession(USER, created.id()).status());
    }

    @Test
    void unconfiguredAndMockDisallowedFailsWithoutPersistingSession() {
        // §8.0：未绑定 modelink 端点 + 生产不允许 mock → 503，不落会话行、不产假授权
        HttpModelinkGateway http = mock(HttpModelinkGateway.class);
        when(http.isConfigured()).thenReturn(false);
        when(http.boundModel()).thenReturn(null);
        DapProperties p = new DapProperties();
        p.getModelink().setAllowMock(false);
        ModelinkService real = new ModelinkService(http, new MockModelinkGateway(), p, null);
        DapRealAuthService s = new DapRealAuthService(groupRepo, captureRepo, real, p, new DapSupport());

        BusinessException ex = assertThrows(BusinessException.class, () -> s.start(USER, "CAP-1"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        assertEquals("DAP_MODELINK_NOT_CONFIGURED", ex.getCode());
        assertTrue(groups.isEmpty(), "未配置时不得留下悬空会话行");
        assertNull(captures.get("CAP-1").getAuthGroupId());
    }

    @Test
    void startRequiresFootage() {
        captures.put("CAP-2", DapCapture.builder().id("CAP-2").ownerUserId(USER).status("created")
                .createdAt(Instant.now()).build());
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.start(USER, "CAP-2"));
        assertEquals("DAP_NO_FOOTAGE", ex.getCode());
    }

    @Test
    void sessionIsOwnerScoped() {
        stubCreate("qg-1");
        RealAuthSessionDto created = svc.start(USER, "CAP-1");
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.getSession("someone_else", created.id()));
        assertEquals("DAP_AUTH_SESSION_NOT_FOUND", ex.getCode());
    }
}
