package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 例行 QA 安全回归（2026-07-22）：DramaAssembleService.download() 之前对 videoUrl 零校验，
 * 用户可经 PUT /me/drama/projects/{id} 把任意字符串写入 shot.videoUrl，assemble() 会原样
 * 服务端 GET 抓取 —— 构成 SSRF（可探内网 / 云 metadata 端点）。断言：非白名单 origin 的绝对
 * URL 在发起任何网络请求之前就被拒绝（ffmpeg / cdnUploader 零交互）。
 */
class DramaAssembleServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private DramaProjectRepository repo;
    private FfmpegRunner ffmpeg;
    private CdnUploader cdnUploader;
    private StorageQuotaService storage;
    private DramaAssembleService svc;

    @BeforeEach
    void setup() {
        repo = mock(DramaProjectRepository.class);
        ffmpeg = mock(FfmpegRunner.class);
        cdnUploader = mock(CdnUploader.class);
        storage = mock(StorageQuotaService.class);
        svc = new DramaAssembleService(repo, ffmpeg, cdnUploader, CdnUrlSigner.NOOP, storage, OM,
                8080, "/cdn", "");
    }

    private DramaProject projectWithShotVideoUrl(String videoUrl) throws Exception {
        String payload = OM.writeValueAsString(OM.readTree(String.format("""
                {"episodeDocs":{"1":{"storyboard":{"scenes":[{"shots":[
                  {"no":1,"videoUrl":"%s"}
                ]}]}}}}
                """, videoUrl)));
        return DramaProject.builder()
                .id("proj-1")
                .ownerUserId("user-1")
                .payloadJson(payload)
                .build();
    }

    @Test
    void assemble_rejectsUntrustedAbsoluteVideoUrl_beforeAnyNetworkCall() throws Exception {
        DramaProject project = projectWithShotVideoUrl("http://100.100.100.200/latest/meta-data/ram/security-credentials/role");
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull("proj-1", "user-1")).thenReturn(Optional.of(project));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.assemble("proj-1", OM.readTree("{\"ep\":1}"), "user-1"));
        assertEquals("VIDEO_URL_NOT_ALLOWED", ex.getCode());

        verifyNoInteractions(ffmpeg);
        verifyNoInteractions(cdnUploader);
    }

    @Test
    void assemble_rejectsUntrustedAbsoluteVideoUrl_evenForOtherHttpHosts() throws Exception {
        DramaProject project = projectWithShotVideoUrl("http://internal-service.local:9000/secret");
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull("proj-1", "user-1")).thenReturn(Optional.of(project));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.assemble("proj-1", OM.readTree("{\"ep\":1}"), "user-1"));
        assertEquals("VIDEO_URL_NOT_ALLOWED", ex.getCode());

        verifyNoInteractions(ffmpeg);
        verifyNoInteractions(cdnUploader);
    }
}
