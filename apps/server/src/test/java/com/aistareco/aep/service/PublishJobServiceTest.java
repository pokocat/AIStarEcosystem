package com.aistareco.aep.service;

import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.model.PublishJobStatus;
import com.aistareco.aep.model.SocialAccount;
import com.aistareco.aep.model.SocialAccountStatus;
import com.aistareco.aep.model.SocialPlatform;
import com.aistareco.aep.repository.PublishJobEventRepository;
import com.aistareco.aep.repository.PublishJobRepository;
import com.aistareco.aep.repository.SocialAccountRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 例行 QA 安全修复回归：
 * 1) startJob 派单前必须校验 videoUrl 落在本仓已知 CDN/自身域内，否则会被 sau-service 服务端
 *    直接 GET 抓取，构成 SSRF（可指向内网服务 / 云 metadata 接口）。
 * 2) resumeInflight() 内必须经 self（@Lazy 自注入代理）调用 applyCallback/resumeFail，
 *    不能用同类自调用（会绕过 Spring AOP 代理，让这两个方法上的 @Transactional 失效）。
 */
class PublishJobServiceTest {

    private PublishJobRepository jobRepo;
    private PublishJobEventRepository eventRepo;
    private SocialAccountRepository accountRepo;
    private SocialAccountSecretService secret;
    private SauServiceClient sau;
    private CreditService creditService;
    private CelebrityActionPricingService actionPricing;
    private PublishJobService svc;

    private static final String USER_ID = "u1";
    private static final String JOB_ID = "job1";
    private static final String ACCOUNT_ID = "acc1";
    // 与构造函数默认 sau.callback-base-url 一致 → origin=http://localhost:8080 天然在白名单内
    private static final String TRUSTED_VIDEO_URL = "http://localhost:8080/cdn/media/x.mp4";

    @BeforeEach
    void setUp() {
        jobRepo = mock(PublishJobRepository.class);
        eventRepo = mock(PublishJobEventRepository.class);
        accountRepo = mock(SocialAccountRepository.class);
        secret = mock(SocialAccountSecretService.class);
        sau = mock(SauServiceClient.class);
        creditService = mock(CreditService.class);
        actionPricing = mock(CelebrityActionPricingService.class);

        when(actionPricing.creditPriceOf(anyString())).thenReturn(20L);
        when(secret.decryptStorageState(anyString())).thenReturn(Map.of("cookies", "x"));
        when(sau.verifyAccountLite(anyString(), anyMap())).thenReturn(Map.of("status", "valid"));
        when(sau.upload(anyMap())).thenReturn(Map.of("taskId", "task-1"));
        when(jobRepo.save(any(PublishJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(accountRepo.save(any(SocialAccount.class))).thenAnswer(inv -> inv.getArgument(0));

        svc = new PublishJobService(jobRepo, eventRepo, accountRepo, secret, sau, creditService,
                actionPricing, CdnUrlSigner.NOOP,
                "aep-test-internal-secret",
                "http://localhost:8080/api/internal/sau",
                20L,
                "/cdn",
                "",
                null);
    }

    private PublishJob job(String videoUrl) {
        return PublishJob.builder()
                .id(JOB_ID).userId(USER_ID).socialAccountId(ACCOUNT_ID)
                .platform(SocialPlatform.DOUYIN).status(PublishJobStatus.QUEUED)
                .videoUrl(videoUrl).title("t").build();
    }

    private SocialAccount account() {
        return SocialAccount.builder()
                .id(ACCOUNT_ID).userId(USER_ID).platform(SocialPlatform.DOUYIN)
                .accountName("acc").status(SocialAccountStatus.ACTIVE)
                .storageStateEncrypted("cipher").build();
    }

    @Test
    void startJobRejectsUntrustedVideoUrlAsSsrf() {
        PublishJob j = job("http://169.254.169.254/latest/meta-data/ram/security-credentials/role");
        when(jobRepo.findByIdAndUserId(JOB_ID, USER_ID)).thenReturn(Optional.of(j));
        when(accountRepo.findByIdAndUserId(ACCOUNT_ID, USER_ID)).thenReturn(Optional.of(account()));

        BusinessException ex = assertThrows(BusinessException.class, () -> svc.startJob(USER_ID, JOB_ID));
        assertEquals("VIDEO_URL_NOT_ALLOWED", ex.getCode());

        // 未通过 SSRF 校验必须在扣费 / 派单之前短路：不 hold、不调 sau.upload。
        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
        verify(sau, never()).upload(anyMap());
    }

    @Test
    void startJobRejectsInternalHostVideoUrl() {
        PublishJob j = job("http://192.168.1.50:9000/internal-admin");
        when(jobRepo.findByIdAndUserId(JOB_ID, USER_ID)).thenReturn(Optional.of(j));
        when(accountRepo.findByIdAndUserId(ACCOUNT_ID, USER_ID)).thenReturn(Optional.of(account()));

        BusinessException ex = assertThrows(BusinessException.class, () -> svc.startJob(USER_ID, JOB_ID));
        assertEquals("VIDEO_URL_NOT_ALLOWED", ex.getCode());
        verify(sau, never()).upload(anyMap());
    }

    @Test
    void startJobAllowsTrustedOriginVideoUrl() {
        PublishJob j = job(TRUSTED_VIDEO_URL);
        when(jobRepo.findByIdAndUserId(JOB_ID, USER_ID)).thenReturn(Optional.of(j));
        when(accountRepo.findByIdAndUserId(ACCOUNT_ID, USER_ID)).thenReturn(Optional.of(account()));

        svc.startJob(USER_ID, JOB_ID);

        verify(sau).upload(argThat(body -> TRUSTED_VIDEO_URL.equals(body.get("videoUrl"))));
        verify(creditService).hold(eq(USER_ID), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void startJobAllowsSelfRelativeCdnPathVideoUrl() {
        // 历史脏数据：publicBase=/cdn 落库的相对路径，同源天然可信。
        PublishJob j = job("/cdn/media/legacy.mp4");
        when(jobRepo.findByIdAndUserId(JOB_ID, USER_ID)).thenReturn(Optional.of(j));
        when(accountRepo.findByIdAndUserId(ACCOUNT_ID, USER_ID)).thenReturn(Optional.of(account()));

        svc.startJob(USER_ID, JOB_ID);

        verify(sau).upload(argThat(body -> "http://localhost:8080/cdn/media/legacy.mp4".equals(body.get("videoUrl"))));
    }

    @Test
    void resumeInflightDispatchesThroughSelfProxyNotRawThis() {
        // 独立起一份实例，注入可观察的 self mock —— 断言 resumeInflight() 走 self.resumeFail(...)
        // 而不是同类自调用 this.resumeFail(...)（后者会绕过 Spring AOP 代理，@Transactional 失效）。
        PublishJobService selfMock = mock(PublishJobService.class);
        PublishJobService instance = new PublishJobService(jobRepo, eventRepo, accountRepo, secret, sau,
                creditService, actionPricing, CdnUrlSigner.NOOP,
                "aep-test-internal-secret", "http://localhost:8080/api/internal/sau", 20L,
                "/cdn", "", selfMock);

        PublishJob inflight = PublishJob.builder()
                .id("job-resume").userId(USER_ID).socialAccountId(ACCOUNT_ID)
                .platform(SocialPlatform.DOUYIN).status(PublishJobStatus.UPLOADING)
                .externalTaskId(null) // 重启时尚未拿到 externalTaskId → RESUME_NO_EXTERNAL_TASK 分支
                .videoUrl(TRUSTED_VIDEO_URL).title("t").build();
        when(jobRepo.findByStatusIn(any())).thenReturn(java.util.List.of(inflight));

        instance.resumeInflight();

        verify(selfMock).resumeFail(eq(inflight), eq("RESUME_NO_EXTERNAL_TASK"), anyString());
        verify(selfMock, never()).applyCallback(any());
    }
}
