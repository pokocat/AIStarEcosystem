package com.aistareco.aep.service;

import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.model.PublishJobStatus;
import com.aistareco.aep.model.SocialAccount;
import com.aistareco.aep.model.SocialAccountStatus;
import com.aistareco.aep.model.SocialPlatform;
import com.aistareco.aep.repository.PublishJobEventRepository;
import com.aistareco.aep.repository.PublishJobRepository;
import com.aistareco.aep.repository.SocialAccountRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * v0.99 例行 QA 新发现：{@code PublishJob.videoUrl}/{@code coverUrl} 落库时是
 * {@code MixcutPublishService} 传入的、创建批次那一刻就已签过名的 CDN URL
 * （{@code MixcutRenderOutputDto.cdnUrl()} 出 wire 时签的）。「按天错峰」调度
 * （daily_recurring 策略）会把同一批 output 铺到未来好几天的固定时段，而签名 TTL
 * （默认 3600s）远短于跨天调度窗口 —— {@link PublishJobService#startJob} 此前原样使用
 * 落库的 URL 派单，创建当天以后的任务一律带着过期签名调 sau-service，直接 403 失败。
 *
 * 锁定：{@code startJob} 必须在派单前对 videoUrl/coverUrl 各调一次
 * {@link CdnUrlSigner#maybeSign(String)} 重签，sau.upload 收到的 body 里必须是重签后的
 * URL，而不是 {@code job} 实体上落库的旧值。
 */
class PublishJobServiceCdnSignTest {

    private static final String USER = "u1";
    private static final String JOB_ID = "job1";
    private static final String ACCOUNT_ID = "acct1";

    private PublishJobRepository jobRepo;
    private SocialAccountRepository accountRepo;
    private SocialAccountSecretService secret;
    private SauServiceClient sau;
    private CreditService creditService;
    private CdnUrlSigner cdnUrlSigner;
    private PublishJobService svc;

    @BeforeEach
    void setUp() {
        jobRepo = mock(PublishJobRepository.class);
        PublishJobEventRepository eventRepo = mock(PublishJobEventRepository.class);
        accountRepo = mock(SocialAccountRepository.class);
        secret = mock(SocialAccountSecretService.class);
        sau = mock(SauServiceClient.class);
        creditService = mock(CreditService.class);
        CelebrityActionPricingService actionPricing = mock(CelebrityActionPricingService.class);
        cdnUrlSigner = mock(CdnUrlSigner.class);

        svc = new PublishJobService(jobRepo, eventRepo, accountRepo, secret, sau, creditService,
                actionPricing, cdnUrlSigner, "internal-secret", "http://localhost:8080/api/internal/sau", 20L);

        when(jobRepo.save(any(PublishJob.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private PublishJob queuedJob() {
        return PublishJob.builder()
                .id(JOB_ID)
                .userId(USER)
                .socialAccountId(ACCOUNT_ID)
                .platform(SocialPlatform.DOUYIN)
                .status(PublishJobStatus.QUEUED)
                .progress(0)
                .videoUrl("https://oss.example.com/publish/job1/video.mp4?x-oss-expires=1&x-oss-signature=stale")
                .coverUrl("https://oss.example.com/publish/job1/cover.jpg?x-oss-expires=1&x-oss-signature=stale")
                .title("测试标题")
                .build();
    }

    private SocialAccount activeAccount() {
        return SocialAccount.builder()
                .id(ACCOUNT_ID)
                .userId(USER)
                .platform(SocialPlatform.DOUYIN)
                .accountName("测试账号")
                .status(SocialAccountStatus.ACTIVE)
                .storageStateEncrypted("cipher")
                .build();
    }

    @Test
    void startJobResignsVideoAndCoverUrlBeforeDispatch() {
        PublishJob job = queuedJob();
        when(jobRepo.findByIdAndUserId(JOB_ID, USER)).thenReturn(Optional.of(job));
        when(accountRepo.findByIdAndUserId(ACCOUNT_ID, USER)).thenReturn(Optional.of(activeAccount()));

        Map<String, Object> storageState = new HashMap<>();
        when(secret.decryptStorageState("cipher")).thenReturn(storageState);

        Map<String, Object> lite = new HashMap<>();
        lite.put("status", "valid");
        when(sau.verifyAccountLite(eq("douyin"), any())).thenReturn(lite);

        String freshVideoUrl = "https://oss.example.com/publish/job1/video.mp4?x-oss-expires=9999999999&x-oss-signature=fresh";
        String freshCoverUrl = "https://oss.example.com/publish/job1/cover.jpg?x-oss-expires=9999999999&x-oss-signature=fresh";
        when(cdnUrlSigner.maybeSign(job.getVideoUrl())).thenReturn(freshVideoUrl);
        when(cdnUrlSigner.maybeSign(job.getCoverUrl())).thenReturn(freshCoverUrl);

        Map<String, Object> sauResp = new HashMap<>();
        sauResp.put("taskId", "ext-task-1");
        when(sau.upload(any())).thenReturn(sauResp);

        PublishJobDto result = svc.startJob(USER, JOB_ID);

        assertEquals("uploading", result.status());
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(sau).upload(bodyCaptor.capture());
        Map<String, Object> body = bodyCaptor.getValue();

        assertEquals(freshVideoUrl, body.get("videoUrl"));
        assertEquals(freshCoverUrl, body.get("coverUrl"));
        assertNotEquals(job.getVideoUrl(), body.get("videoUrl"));

        verify(cdnUrlSigner).maybeSign("https://oss.example.com/publish/job1/video.mp4?x-oss-expires=1&x-oss-signature=stale");
        verify(cdnUrlSigner).maybeSign("https://oss.example.com/publish/job1/cover.jpg?x-oss-expires=1&x-oss-signature=stale");
    }

    @Test
    void startJobOmitsCoverUrlWhenNotSet() {
        PublishJob job = queuedJob();
        job.setCoverUrl(null);
        when(jobRepo.findByIdAndUserId(JOB_ID, USER)).thenReturn(Optional.of(job));
        when(accountRepo.findByIdAndUserId(ACCOUNT_ID, USER)).thenReturn(Optional.of(activeAccount()));
        when(secret.decryptStorageState("cipher")).thenReturn(new HashMap<>());

        Map<String, Object> lite = new HashMap<>();
        lite.put("status", "valid");
        when(sau.verifyAccountLite(eq("douyin"), any())).thenReturn(lite);

        when(cdnUrlSigner.maybeSign(job.getVideoUrl()))
                .thenReturn("https://oss.example.com/publish/job1/video.mp4?fresh=1");
        when(cdnUrlSigner.maybeSign(null)).thenReturn(null);

        Map<String, Object> sauResp = new HashMap<>();
        sauResp.put("taskId", "ext-task-2");
        when(sau.upload(any())).thenReturn(sauResp);

        svc.startJob(USER, JOB_ID);

        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(sau).upload(bodyCaptor.capture());
        assertFalse(bodyCaptor.getValue().containsKey("coverUrl"));
    }
}
