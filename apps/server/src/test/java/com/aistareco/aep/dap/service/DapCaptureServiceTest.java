package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapLicense;
import com.aistareco.aep.dap.model.DapMaterial;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapLicenseRepository;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.aep.dap.repository.DapMaterialRepository;
import com.aistareco.aep.dap.service.modelink.ModelinkGateway.AssetState;
import com.aistareco.aep.dap.service.modelink.ModelinkService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DapCaptureService.verify（v0.105 起接真实刷脸认证）：
 * 无 active 认证会话 → 409；通过 → verified + 授权标 liveness + 素材自动送审；
 * 送审失败不阻断核验（合规旁路）。
 */
class DapCaptureServiceTest {

    private static final String USER = "u_owner";

    private Map<String, DapCapture> captures;
    private Map<String, DapLicense> licenses;
    private Map<String, DapMaterial> materials;
    private DapCaptureRepository captureRepo;
    private DapMaterialGroupRepository groupRepo;
    private DapLicenseRepository licenseRepo;
    private DapMaterialRepository materialRepo;
    private DapAvatarService avatarService;
    private DapLicenseService licenseService;
    private DapMaterialService materialService;
    private DapRealAuthService realAuth;
    private ModelinkService modelink;
    private DapAvatar avatar;
    private DapCaptureService svc;

    @BeforeEach
    void setUp() {
        captures = new HashMap<>();
        licenses = new HashMap<>();
        materials = new HashMap<>();

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

        groupRepo = mock(DapMaterialGroupRepository.class);

        licenseRepo = mock(DapLicenseRepository.class);
        when(licenseRepo.save(any())).thenAnswer(inv -> {
            DapLicense l = inv.getArgument(0);
            licenses.put(l.getId(), l);
            return l;
        });
        when(licenseRepo.existsById(anyString())).thenAnswer(inv -> licenses.containsKey(inv.getArgument(0, String.class)));
        when(licenseRepo.findFirstByAvatarIdAndOwnerUserId(anyString(), anyString())).thenAnswer(inv ->
                licenses.values().stream()
                        .filter(l -> inv.getArgument(0, String.class).equals(l.getAvatarId())
                                && inv.getArgument(1, String.class).equals(l.getOwnerUserId()))
                        .findFirst());

        materialRepo = mock(DapMaterialRepository.class);
        when(materialRepo.save(any())).thenAnswer(inv -> {
            DapMaterial m = inv.getArgument(0);
            materials.put(m.getId(), m);
            return m;
        });
        when(materialRepo.existsById(anyString())).thenAnswer(inv -> materials.containsKey(inv.getArgument(0, String.class)));
        when(materialRepo.findByRefTypeAndRefIdAndOwnerUserIdOrderByCreatedAtDesc(anyString(), anyString(), anyString()))
                .thenAnswer(inv -> new ArrayList<>(materials.values().stream()
                        .filter(m -> inv.getArgument(0, String.class).equals(m.getRefType())
                                && inv.getArgument(1, String.class).equals(m.getRefId()))
                        .toList()));

        FileStorageService storage = mock(FileStorageService.class);
        when(storage.signedUrl(anyString())).thenAnswer(inv -> "https://cdn.example/" + inv.getArgument(0, String.class));

        avatar = DapAvatar.builder().id("DH-1").ownerUserId(USER).name("周野").path("real").build();
        avatarService = mock(DapAvatarService.class);
        when(avatarService.required(eq(USER), eq("DH-1"))).thenReturn(avatar);

        modelink = mock(ModelinkService.class);
        when(modelink.boundModel()).thenReturn("m1");
        when(modelink.createAsset(anyString(), anyString(), anyString(), anyString(), any()))
                .thenReturn(new AssetState("qa-1", "pending", null));

        licenseService = new DapLicenseService(licenseRepo, storage, new DapSupport());
        realAuth = mock(DapRealAuthService.class);
        materialService = new DapMaterialService(materialRepo, mock(DapAvatarRepository.class), captureRepo,
                realAuth, mock(DapAigcGroupResolver.class), modelink, storage, new DapSupport());
        svc = new DapCaptureService(captureRepo, groupRepo, avatarService, licenseService, realAuth,
                materialService, storage, new DapSupport());

        captures.put("CAP-1", DapCapture.builder().id("CAP-1").ownerUserId(USER).avatarId("DH-1")
                .status("footage_uploaded").footageKey("dap/capture/u/a.webm")
                .footageContentType("video/webm").frameKey("dap/capture/u/a.png")
                .createdAt(Instant.now()).build());
    }

    private DapMaterialGroup activeGroup() {
        return DapMaterialGroup.builder().id("MG-1").ownerUserId(USER).kind("liveness_face")
                .qgroupid("qg-1").status("active").callbackToken("tok").createdAt(Instant.now()).build();
    }

    @Test
    void verifyRejectsWhenFaceAuthNotCompleted() {
        when(realAuth.requireActiveSession(eq(USER), any())).thenThrow(
                new BusinessException(HttpStatus.CONFLICT, "DAP_AUTH_NOT_COMPLETED", "请先完成刷脸认证"));

        BusinessException ex = assertThrows(BusinessException.class, () -> svc.verify(USER, "CAP-1"));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("DAP_AUTH_NOT_COMPLETED", ex.getCode());
        assertEquals("footage_uploaded", captures.get("CAP-1").getStatus(), "未认证不得标 verified");
        assertTrue(licenses.isEmpty(), "未认证不得自动发授权");
    }

    @Test
    void verifyRequiresFootageBeforeAuthCheck() {
        captures.put("CAP-2", DapCapture.builder().id("CAP-2").ownerUserId(USER).status("created")
                .createdAt(Instant.now()).build());
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.verify(USER, "CAP-2"));
        assertEquals("DAP_NO_FOOTAGE", ex.getCode());
        verify(realAuth, never()).requireActiveSession(anyString(), any());
    }

    @Test
    void verifyIssuesLivenessLicenseAndSubmitsMaterials() {
        when(realAuth.requireActiveSession(eq(USER), any())).thenReturn(activeGroup());

        Map<String, Object> out = svc.verify(USER, "CAP-1");

        assertEquals(true, out.get("passed"));
        assertEquals("MG-1", out.get("authSessionId"));
        assertNotNull(out.get("licenseId"));
        assertEquals("verified", captures.get("CAP-1").getStatus());
        assertNotNull(captures.get("CAP-1").getVerifiedAt());

        DapLicense lic = licenses.get(out.get("licenseId"));
        assertEquals("liveness", lic.getVerifyMethod(), "刷脸取得的授权可取证");
        assertEquals("MG-1", lic.getLivenessGroupId());
        assertEquals("active", lic.getStatus());
        assertEquals(lic.getId(), avatar.getLicenseId());

        assertEquals(2, materials.size(), "动作素材 + 关键帧各送审一条");
        materials.values().forEach(m -> {
            assertEquals("capture", m.getRefType());
            assertEquals("CAP-1", m.getRefId());
            assertEquals("MG-1", m.getGroupId());
        });
    }

    @Test
    void existingDeclaredLicenseIsUpgradedToLiveness() {
        licenses.put("LIC-9", DapLicense.builder().id("LIC-9").ownerUserId(USER).avatarId("DH-1")
                .subject("周野（本人）").status("active").photoCount(0).createdAt(Instant.now()).build());
        when(realAuth.requireActiveSession(eq(USER), any())).thenReturn(activeGroup());

        Map<String, Object> out = svc.verify(USER, "CAP-1");

        assertEquals("LIC-9", out.get("licenseId"));
        assertEquals(1, licenses.size(), "已有授权只回填不重复登记");
        assertEquals("liveness", licenses.get("LIC-9").getVerifyMethod());
        assertEquals("MG-1", licenses.get("LIC-9").getLivenessGroupId());
    }

    @Test
    void materialSubmissionFailureDoesNotBlockVerify() {
        when(realAuth.requireActiveSession(eq(USER), any())).thenReturn(activeGroup());
        when(modelink.createAsset(anyString(), anyString(), anyString(), anyString(), any()))
                .thenThrow(new BusinessException(HttpStatus.BAD_GATEWAY, "DAP_MODELINK_CALL_FAILED", "上游抖动"));

        Map<String, Object> out = svc.verify(USER, "CAP-1");

        assertEquals(true, out.get("passed"));
        assertEquals("verified", captures.get("CAP-1").getStatus());
        assertNotNull(out.get("licenseId"), "送审是合规旁路，失败不回滚核验与授权");
        assertTrue(materials.isEmpty());
    }

    @Test
    void verifyIsOwnerScoped() {
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.verify("someone_else", "CAP-1"));
        assertEquals("DAP_CAPTURE_NOT_FOUND", ex.getCode());
    }
}
