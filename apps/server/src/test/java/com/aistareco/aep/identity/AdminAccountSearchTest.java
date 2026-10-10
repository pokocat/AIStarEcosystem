package com.aistareco.aep.identity;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** 真 H2/JPA 查询，验证筛选发生在分页前、null 字段以及 %/_ 的字面量语义。 */
class AdminAccountSearchTest {
    private static LocalContainerEntityManagerFactoryBean factory;
    private EntityManager em;
    private AepUserRepository repo;

    @BeforeAll
    static void database() {
        factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(new DriverManagerDataSource("jdbc:h2:mem:account-search;DB_CLOSE_DELAY=-1", "sa", ""));
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setManagedTypes(PersistenceManagedTypes.of(AepUser.class.getName()));
        factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop"));
        factory.afterPropertiesSet();
    }

    @AfterAll
    static void stop() { factory.destroy(); }

    @BeforeEach
    void start() {
        em = factory.getObject().createEntityManager();
        repo = new JpaRepositoryFactory(em).getRepository(AepUserRepository.class);
        em.getTransaction().begin();
    }

    @AfterEach
    void rollback() { em.getTransaction().rollback(); em.close(); }

    private AepUser row(String id, String name, String phone, AepUser.UserStatus status, long created) {
        AepUser user = AepUser.builder().id(id).username("fixture_" + id).displayName(name).phone(phone)
                .status(status).kind(AepUser.AccountKind.PERSONAL).identityUid("uid-" + id)
                .createdAt(Instant.ofEpochSecond(created)).build();
        em.persist(user);
        return user;
    }

    @Test
    void phoneSearchFindsUserOutsideFirstHundredAndReturnsAccurateTotal() {
        AepUser target = row("target", "测试昵称", "13900000001", AepUser.UserStatus.ACTIVE, 1);
        for (int i = 0; i < 105; i++) row("newer-" + i, null, null, AepUser.UserStatus.ACTIVE, i + 10);
        em.flush();
        var first = PageRequest.of(0, 100, Sort.by("createdAt").descending());
        assertThat(repo.findAll(first).getContent()).doesNotContain(target);
        var found = repo.search("13900000001", null, null, PageRequest.of(0, 20));
        assertThat(found.getTotalElements()).isEqualTo(1);
        assertThat(found.getContent()).extracting(AepUser::getId).containsExactly("target");
    }

    @Test
    void emailUidAndNameSearchRespectStatusAndKind() {
        AepUser active = row("active", "Alpha Example", null, AepUser.UserStatus.ACTIVE, 1);
        active.setEmail("Fixture@Example.Test");
        row("suspended", "Alpha Example", null, AepUser.UserStatus.SUSPENDED, 2);
        em.flush();
        assertThat(repo.search("alpha", AepUser.UserStatus.ACTIVE, AepUser.AccountKind.PERSONAL, PageRequest.of(0, 20))
                .getContent()).extracting(AepUser::getId).containsExactly("active");
        assertThat(repo.search("fixture@example.test", null, null, PageRequest.of(0, 20)).getTotalElements()).isEqualTo(1);
        assertThat(repo.search("uid-active", null, null, PageRequest.of(0, 20)).getTotalElements()).isEqualTo(1);
        assertThat(repo.search("alpha", null, AepUser.AccountKind.STUDIO, PageRequest.of(0, 20)).isEmpty()).isTrue();
    }

    @Test
    void percentAndUnderscoreDoNotMatchEveryUser() {
        row("plain", "普通昵称", null, AepUser.UserStatus.ACTIVE, 1);
        row("literal", "昵称有%符号", null, AepUser.UserStatus.ACTIVE, 2);
        em.flush();
        assertThat(repo.search("%", null, null, PageRequest.of(0, 20)).getContent())
                .extracting(AepUser::getId).containsExactly("literal");
        assertThat(repo.search("uid_plain", null, null, PageRequest.of(0, 20)).isEmpty()).isTrue();
    }
    @Test
    void realJpaMergeReleasesUidBeforeCreatingTombstoneAndClosureBeforeLoginIsRemembered() throws Exception {
        AepUser original = row("merge-real", "original", "13900000003", AepUser.UserStatus.ACTIVE, 1);
        em.flush();
        var handler = new IdentityOutboxHandler(repo, org.mockito.Mockito.mock(IdentityPhoneSyncService.class));
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        handler.handle(new IdentityCenterClient.OutboxEvent(1, "USER_MERGED", "uid-merge-real",
                mapper.readTree("{\"fromUid\":\"uid-merge-real\",\"toUid\":\"uid-survivor\"}")));
        em.flush();
        em.clear();
        assertThat(repo.findByIdentityUid("uid-survivor").orElseThrow().getId()).isEqualTo(original.getId());
        assertThat(repo.findByIdentityUid("uid-merge-real").orElseThrow().getStatus()).isEqualTo(AepUser.UserStatus.DELETED);
        handler.handle(new IdentityCenterClient.OutboxEvent(2, "USER_CLOSED", "uid-not-yet-local", mapper.readTree("{}")));
        em.flush();
        em.clear();
        assertThat(repo.findByIdentityUid("uid-not-yet-local").orElseThrow().getStatus()).isEqualTo(AepUser.UserStatus.DELETED);
        assertThat(repo.findByIdentityUid("uid-not-yet-local").orElseThrow().getPlatforms()).isEmpty();
    }

}
