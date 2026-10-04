package com.aistareco.aep.config;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.materialvideo.MaterialVideoCover;
import com.aistareco.aep.service.storage.FileStorageService;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * v0.199.1 补封面：查询与「只在没有封面时写」都用<b>真 JPQL</b>在 H2（MySQL 模式）上跑
 * （仓库经 Spring Data {@link JpaRepositoryFactory} 建，@Query 写错在这一步就抛）。
 * 截帧本身见 {@code MaterialVideoCoverTest}，这里换成 mock。
 */
class MaterialVideoCoverBackfillTest {

    private static final String OSS = "https://oss.test/";

    private SessionFactory sf;
    private EntityManager em;
    private MaterialVideoJobRepository repo;
    private final FileStorageService storage = mock(FileStorageService.class);
    private final MaterialVideoCover cover = mock(MaterialVideoCover.class);
    private MaterialVideoCoverBackfill backfill;

    @BeforeEach
    void setUp() throws Exception {
        String url = "jdbc:h2:mem:mvj_cover_" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
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
        backfill = new MaterialVideoCoverBackfill(repo, storage, cover);

        // 我方存储的地址才认得出 key；厂商外链认不出
        when(storage.keyOfStoredUrl(anyString())).thenAnswer(inv -> {
            String u = inv.getArgument(0);
            return u.startsWith(OSS) ? u.substring(OSS.length()) : null;
        });
        Path local = Files.createTempFile("backfill-video-", ".mp4");
        local.toFile().deleteOnExit();
        when(storage.openForRead(anyString())).thenReturn(local);
        when(cover.extractAndUpload(anyString(), any(Path.class)))
                .thenAnswer(inv -> OSS + "material-videos/" + inv.getArgument(0) + "/thumbnail.jpg");
        when(cover.extractAndUpload(eq("mvj_broken"), any(Path.class))).thenReturn(null);
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

    private void insert(String id, String kind, String status, String videoUrl, String thumbnailUrl) {
        tx(() -> repo.save(MaterialVideoJob.builder().id(id).ownerUserId("u1").app("celebrity").kind(kind)
                .name("作品").status(status).progress(100).creditsHeld(200L)
                .videoUrl(videoUrl).thumbnailUrl(thumbnailUrl)
                .createdAt(OffsetDateTime.now()).completedAt(OffsetDateTime.now()).build()));
    }

    private void seed() {
        insert("mvj_t2v", "studio-t2v", "succeeded", OSS + "material-videos/mvj_t2v/video.mp4", null);
        insert("mvj_ref", "studio-ref", "succeeded", OSS + "material-videos/mvj_ref/video.mp4", null);
        insert("mvj_broken", "studio-i2v", "succeeded", OSS + "material-videos/mvj_broken/video.mp4", null);
        insert("mvj_vendor", "studio-t2v", "succeeded", "https://vendor.example/out.mp4", null);
        insert("mvj_has", "studio-flf", "succeeded", OSS + "material-videos/mvj_has/video.mp4", OSS + "mine.jpg");
        insert("mvj_failed", "studio-flf", "failed", null, null);
        insert("mvj_drama", "drama-canvas", "succeeded", OSS + "material-videos/mvj_drama/video.mp4", null);
    }

    private String thumb(String id) {
        return repo.findById(id).orElseThrow().getThumbnailUrl();
    }

    @Test
    void findCoverless_onlyPicksSucceededStudioJobsWithAVideoAndNoCover() {
        seed();

        Set<String> ids = repo.findCoverless("studio-", PageRequest.of(0, 50)).stream()
                .map(MaterialVideoJob::getId).collect(Collectors.toSet());

        assertEquals(Set.of("mvj_t2v", "mvj_ref", "mvj_broken", "mvj_vendor"), ids);
    }

    @Test
    void fillOnce_fillsWhatItCan_andLeavesTheRestForNextTime() throws Exception {
        seed();

        assertEquals(2, tx(backfill::fillOnce));

        assertEquals(OSS + "material-videos/mvj_t2v/thumbnail.jpg", thumb("mvj_t2v"));
        assertEquals(OSS + "material-videos/mvj_ref/thumbnail.jpg", thumb("mvj_ref"));
        assertNull(thumb("mvj_broken"), "截不出来就不写");
        assertNull(thumb("mvj_vendor"), "成片不在我方存储，不去下");
        assertNull(thumb("mvj_drama"), "别的分区的老任务不动");
        assertEquals(OSS + "mine.jpg", thumb("mvj_has"));

        // 再跑一次：补过的查不到了，只剩截不出来的那条会再试
        assertEquals(0, tx(backfill::fillOnce));
        verify(cover, times(1)).extractAndUpload(eq("mvj_t2v"), any(Path.class));
        verify(cover, times(2)).extractAndUpload(eq("mvj_broken"), any(Path.class));
        verify(cover, never()).extractAndUpload(eq("mvj_vendor"), any(Path.class));
    }

    @Test
    void setThumbnailIfMissing_neverOverwritesACover() {
        seed();

        assertEquals(0, tx(() -> repo.setThumbnailIfMissing("mvj_has", OSS + "other.jpg", OffsetDateTime.now())));
        assertEquals(OSS + "mine.jpg", thumb("mvj_has"));
        assertEquals(1, tx(() -> repo.setThumbnailIfMissing("mvj_t2v", OSS + "a.jpg", OffsetDateTime.now())));
        assertEquals(0, tx(() -> repo.setThumbnailIfMissing("mvj_t2v", OSS + "b.jpg", OffsetDateTime.now())));
        assertEquals(OSS + "a.jpg", thumb("mvj_t2v"));
    }
}
