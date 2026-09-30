package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CelebrityActionPricingService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.ProductService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.cfg.AvailableSettings;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import java.time.OffsetDateTime;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * v0.198 取消 / 超时 与 worker 认领的互斥，用<b>真 JPQL</b>在 H2（MySQL 模式）上跑：
 * 两边都是 {@code WHERE status='queued'} 的条件更新，谁先提交谁赢，后到的影响 0 行。
 * 仓库经 Spring Data {@link JpaRepositoryFactory} 建（派生查询 / @Query 写错在这一步就抛）。
 */
class MaterialVideoJobClaimTest {

    private SessionFactory sf;
    private EntityManager em;
    private MaterialVideoJobRepository repo;
    private final CreditService credits = mock(CreditService.class);
    private MaterialVideoJobService svc;

    @BeforeEach
    void setUp() {
        String url = "jdbc:h2:mem:mvj_claim_" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
        StandardServiceRegistry registry = new StandardServiceRegistryBuilder()
                .applySetting(AvailableSettings.JAKARTA_JDBC_URL, url)
                .applySetting(AvailableSettings.JAKARTA_JDBC_USER, "sa")
                .applySetting(AvailableSettings.JAKARTA_JDBC_PASSWORD, "")
                .applySetting(AvailableSettings.HBM2DDL_AUTO, "create-drop")
                .applySetting(AvailableSettings.PHYSICAL_NAMING_STRATEGY, CamelCaseToUnderscoresNamingStrategy.class.getName())
                .build();
        sf = new MetadataSources(registry).addAnnotatedClass(MaterialVideoJob.class).buildMetadata().buildSessionFactory();
        em = sf.createEntityManager();
        repo = new JpaRepositoryFactory(em).getRepository(MaterialVideoJobRepository.class);
        svc = new MaterialVideoJobService(repo, mock(MaterialVideoModelClient.class), mock(MaterialVideoWorker.class),
                credits, mock(CelebrityActionPricingService.class), mock(ProductService.class),
                mock(AiModelInvocationService.class), new ObjectMapper(), CdnUrlSigner.NOOP);
    }

    @AfterEach
    void tearDown() {
        em.close();
        sf.close();
    }

    private <T> T tx(Supplier<T> work) {
        em.getTransaction().begin();
        T out = work.get();
        em.getTransaction().commit();
        em.clear();
        return out;
    }

    private void insert(String id, String owner, String status, String externalTaskId) {
        tx(() -> repo.save(MaterialVideoJob.builder().id(id).ownerUserId(owner).app("drama").kind("drama-canvas")
                .name("片段").status(status).progress(0).creditsHeld(40L).externalTaskId(externalTaskId)
                .createdAt(OffsetDateTime.now()).build()));
    }

    @Test
    void cancelFirst_thenClaimLoses_neverSubmitted() {
        insert("mvj_a", "u1", "queued", null);
        assertTrue(tx(() -> svc.cancelQueued("mvj_a", "u1")));
        assertEquals(0, tx(() -> repo.claimQueued("mvj_a", OffsetDateTime.now())), "取消赢了，worker 认领影响 0 行");
        MaterialVideoJob a = repo.findById("mvj_a").orElseThrow();
        assertEquals("failed", a.getStatus());
        assertEquals(MaterialVideoJobService.CANCELED_MESSAGE, a.getErrorMessage());
        verify(credits).releaseHold(eq("material_video_job"), eq("mvj_a"), anyString());
    }

    @Test
    void claimFirst_thenCancelLoses_noRefund() {
        insert("mvj_b", "u1", "queued", null);
        assertEquals(1, tx(() -> repo.claimQueued("mvj_b", OffsetDateTime.now())));
        assertFalse(tx(() -> svc.cancelQueued("mvj_b", "u1")), "已经被接手，取消失败");
        assertEquals("submitting", repo.findById("mvj_b").orElseThrow().getStatus());
        verifyNoInteractions(credits);
    }

    @Test
    void expireOnlyTouchesOwnNeverSubmittedJobs() {
        insert("mvj_c", "u1", "queued", "task_already_sent");
        insert("mvj_d", "u2", "queued", null);
        assertFalse(tx(() -> svc.expireQueued("mvj_c", "u1", "排队太久")), "有 externalTaskId 的只能对账");
        assertFalse(tx(() -> svc.expireQueued("mvj_d", "u1", "排队太久")), "不是本人的不动");
        assertEquals("queued", repo.findById("mvj_c").orElseThrow().getStatus());
        assertEquals("queued", repo.findById("mvj_d").orElseThrow().getStatus());
        assertTrue(tx(() -> svc.expireQueued("mvj_d", "u2", "排队太久")));
        assertEquals("排队太久", repo.findById("mvj_d").orElseThrow().getErrorMessage());
        verify(credits, times(1)).releaseHold(eq("material_video_job"), eq("mvj_d"), anyString());
    }
}
