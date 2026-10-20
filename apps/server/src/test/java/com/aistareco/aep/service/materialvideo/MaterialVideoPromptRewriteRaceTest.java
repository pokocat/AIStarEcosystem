package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Recording the vendor's rewritten prompt is a side record: it must never move a job's status, output or settlement.
 * Real H2 transactions and row locks; the interleaving is forced with latches (Codex review of 47c057ea, P2):
 * a settlement holds the row and completes the job while the worker records the rewrite from its own poll.
 */
@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class MaterialVideoPromptRewriteRaceTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final String JOB = "mvj_race";
    private static final String VIDEO = "/cdn/material-videos/mvj_race/video.mp4";

    @Autowired MaterialVideoJobRepository jobs;
    @Autowired PlatformTransactionManager transactions;
    @Autowired EntityManager entityManager;

    private CreditService credits;
    private MaterialVideoWorker worker;

    @BeforeEach
    void setUp() {
        jobs.deleteAll();
        credits = mock(CreditService.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<CdnUploader> uploader = mock(ObjectProvider.class);
        worker = new MaterialVideoWorker(jobs, mock(MaterialVideoModelClient.class), new MaterialVideoProperties(), credits,
                mock(StorageQuotaService.class), uploader, mock(MaterialVideoCover.class));
        worker.transactionManager(transactions);
        ReflectionTestUtils.setField(worker, "entityManager", entityManager);
        jobs.saveAndFlush(MaterialVideoJob.builder().id(JOB).ownerUserId("u1").app(MaterialVideoJobService.APP_IPSTUDIO)
                .name("画布视频").kind("ipstudio-clip").prompt("老周：等等？").durationSec(8).aspectRatio("16:9")
                .status("generating").progress(40).creditsHeld(320L).externalTaskId("job_1")
                .payloadJson("{\"credit_label\":\"Studio 视频生成\"}").createdAt(OffsetDateTime.now()).build());
    }

    private static VideoPromptRewrite rewrite() {
        return new VideoPromptRewrite("succeeded", "optimized", "He says (S1) <d>[Chinese]等等</d>", "popt_1", "v8");
    }

    @Test
    void aRewriteRecordedWhileTheJobSettlesNeverRevertsTheSettlement() throws Exception {
        var settlementLocked = new CountDownLatch(1);
        var recordStarted = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var settle = pool.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
                MaterialVideoJob job = jobs.lockById(JOB).orElseThrow();
                job.setStatus("succeeded");
                job.setProgress(100);
                job.setVideoUrl(VIDEO);
                job.setCompletedAt(OffsetDateTime.now());
                jobs.saveAndFlush(job);
                settlementLocked.countDown();
                try {
                    recordStarted.await(5, TimeUnit.SECONDS);
                    Thread.sleep(300); // the worker is recording while this settlement is still uncommitted
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            var record = pool.submit(() -> {
                settlementLocked.await(5, TimeUnit.SECONDS);
                recordStarted.countDown();
                worker.recordPromptRewrite(JOB, rewrite());
                return null;
            });
            settle.get(15, TimeUnit.SECONDS);
            record.get(15, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        MaterialVideoJob job = jobs.findById(JOB).orElseThrow();
        assertEquals("succeeded", job.getStatus());
        assertEquals(100, job.getProgress());
        assertEquals(VIDEO, job.getVideoUrl());
        assertNotNull(job.getCompletedAt());
        assertEquals(320L, job.getCreditsHeld());
        var payload = OM.readTree(job.getPayloadJson());
        assertEquals("Studio 视频生成", payload.path("credit_label").asText());
        assertEquals("He says (S1) <d>[Chinese]等等</d>", payload.path(VideoPromptRewrite.PAYLOAD_KEY).path("prompt").asText());
        verifyNoInteractions(credits);
    }

    @Test
    void aJobThatAlreadySucceededKeepsItsOutputAndOtherPayloadKeys() throws Exception {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            MaterialVideoJob job = jobs.lockById(JOB).orElseThrow();
            job.setStatus("succeeded");
            job.setVideoUrl(VIDEO);
            job.setPayloadJson("{\"credit_label\":\"Studio 视频生成\",\"caller_priced\":true}");
            jobs.saveAndFlush(job);
        });

        worker.recordPromptRewrite(JOB, rewrite());
        worker.recordPromptRewrite(JOB, rewrite()); // unchanged: no second write needed, nothing else moves

        MaterialVideoJob job = jobs.findById(JOB).orElseThrow();
        assertEquals("succeeded", job.getStatus());
        assertEquals(VIDEO, job.getVideoUrl());
        var payload = OM.readTree(job.getPayloadJson());
        assertEquals(true, payload.path("caller_priced").asBoolean());
        assertEquals("Studio 视频生成", payload.path("credit_label").asText());
        assertEquals("popt_1", payload.path(VideoPromptRewrite.PAYLOAD_KEY).path("optimizationId").asText());
    }
}
