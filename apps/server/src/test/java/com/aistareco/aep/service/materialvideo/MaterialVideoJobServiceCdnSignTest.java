package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.CelebrityActionPricingService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.ProductService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * v0.99 例行 QA 新发现（同类 AGENTS.md §4.7.7 教训）：{@code MaterialVideoJob.videoUrl} /
 * {@code thumbnailUrl} / {@code lastFrameUrl} 落库时是 {@code AliyunOssCdnUploader.upload()}
 * 返回的未签名 {@code publicUrlFor(key)}，此前 {@code toCard} 原样透传出 wire —— 生产
 * driver=oss 且开启防盗刷签名时这三个 URL 从落库那一刻就没签，直接 403（不是 1h TTL 过期）。
 *
 * 锁定：{@code toCard} 必须把三个 URL 字段过一遍 {@link CdnUrlSigner#maybeSign(String)}
 * 才能出 wire。
 */
class MaterialVideoJobServiceCdnSignTest {

    private MaterialVideoJobRepository jobRepo;
    private CdnUrlSigner cdnUrlSigner;
    private MaterialVideoJobService svc;

    @BeforeEach
    void setUp() {
        jobRepo = mock(MaterialVideoJobRepository.class);
        MaterialVideoModelClient modelClient = mock(MaterialVideoModelClient.class);
        MaterialVideoWorker worker = mock(MaterialVideoWorker.class);
        CreditService creditService = mock(CreditService.class);
        CelebrityActionPricingService actionPricing = mock(CelebrityActionPricingService.class);
        ProductService productService = mock(ProductService.class);
        cdnUrlSigner = mock(CdnUrlSigner.class);
        svc = new MaterialVideoJobService(jobRepo, modelClient, worker, creditService,
                actionPricing, productService, mock(com.aistareco.aep.service.AiModelInvocationService.class),
                new ObjectMapper(), cdnUrlSigner);
    }

    @Test
    void toCardSignsVideoThumbnailAndLastFrameUrls() {
        MaterialVideoJob job = MaterialVideoJob.builder()
                .id("mvj_1")
                .status("succeeded")
                .progress(100)
                .videoUrl("https://oss.example.com/material-videos/mvj_1/video.mp4")
                .thumbnailUrl("https://oss.example.com/material-videos/mvj_1/thumbnail.jpg")
                .lastFrameUrl("https://oss.example.com/material-videos/mvj_1/lastframe.jpg")
                .createdAt(OffsetDateTime.now())
                .build();

        when(cdnUrlSigner.maybeSign("https://oss.example.com/material-videos/mvj_1/video.mp4"))
                .thenReturn("https://oss.example.com/material-videos/mvj_1/video.mp4?signed=1");
        when(cdnUrlSigner.maybeSign("https://oss.example.com/material-videos/mvj_1/thumbnail.jpg"))
                .thenReturn("https://oss.example.com/material-videos/mvj_1/thumbnail.jpg?signed=1");
        when(cdnUrlSigner.maybeSign("https://oss.example.com/material-videos/mvj_1/lastframe.jpg"))
                .thenReturn("https://oss.example.com/material-videos/mvj_1/lastframe.jpg?signed=1");

        JsonNode card = svc.toCard(job);

        assertEquals("https://oss.example.com/material-videos/mvj_1/video.mp4?signed=1",
                card.get("video_url").asText());
        assertEquals("https://oss.example.com/material-videos/mvj_1/thumbnail.jpg?signed=1",
                card.get("thumbnail_url").asText());
        assertEquals("https://oss.example.com/material-videos/mvj_1/lastframe.jpg?signed=1",
                card.get("last_frame_url").asText());
        verify(cdnUrlSigner).maybeSign("https://oss.example.com/material-videos/mvj_1/video.mp4");
        verify(cdnUrlSigner).maybeSign("https://oss.example.com/material-videos/mvj_1/thumbnail.jpg");
        verify(cdnUrlSigner).maybeSign("https://oss.example.com/material-videos/mvj_1/lastframe.jpg");
    }

    @Test
    void toCardOmitsUrlFieldsWhenNotSet() {
        MaterialVideoJob job = MaterialVideoJob.builder()
                .id("mvj_2")
                .status("queued")
                .progress(0)
                .createdAt(OffsetDateTime.now())
                .build();

        JsonNode card = svc.toCard(job);

        assertFalse(card.has("video_url"));
        assertFalse(card.has("thumbnail_url"));
        assertFalse(card.has("last_frame_url"));
        verifyNoInteractions(cdnUrlSigner);
    }
}
