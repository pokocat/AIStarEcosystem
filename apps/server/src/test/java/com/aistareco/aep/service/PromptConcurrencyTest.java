package com.aistareco.aep.service;

import com.aistareco.aep.dto.PromptTemplateUpsertDto;
import com.aistareco.aep.repository.PromptTemplateRepository;
import com.aistareco.aep.repository.PromptTemplateVersionRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.datasource.url=jdbc:h2:mem:prompt_cas_test;DB_CLOSE_DELAY=-1;NON_KEYWORDS=CAST"})
@Import({PromptService.class, PromptConcurrencyTest.MapperConfig.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PromptConcurrencyTest {
    @TestConfiguration static class MapperConfig { @Bean ObjectMapper mapper() { return new ObjectMapper(); } }
    @MockBean AiModelInvocationService invocation;
    @Autowired PromptService service;
    @Autowired PromptTemplateRepository repo;
    @Autowired PromptTemplateVersionRepository versions;
    @Autowired PlatformTransactionManager transactions;
    private PromptTemplateUpsertDto value(String text) { return new PromptTemplateUpsertDto(text, "{{input}}", null, true, "test"); }

    @Test void twoEditorsOfSameVersionCommitExactlyOneContentAndSnapshot() throws Exception {
        String key = "concurrency.existing";
        var initial = service.upsert(key, value("initial"), "seed", 0);
        var gate = new CyclicBarrier(2);
        var workers = Executors.newFixedThreadPool(2);
        try {
            Callable<Boolean> writeA = writer(key, initial.version(), "A", gate);
            Callable<Boolean> writeB = writer(key, initial.version(), "B", gate);
            var a = workers.submit(writeA); var b = workers.submit(writeB);
            assertNotEquals(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
        } finally { workers.shutdownNow(); }
        var current = service.getForAdmin(key);
        assertEquals(2, current.version());
        var history = service.versions(key);
        assertEquals(2, history.size());
        assertEquals(current.systemPrompt(), history.get(0).systemPrompt());
        assertEquals(2, history.get(0).version());
    }

    @Test void concurrentFirstSaveCannotProduceTwoVersionOnes() throws Exception {
        String key = "appearance.forge";
        assertEquals(0, service.getForAdmin(key).version());
        var gate = new CyclicBarrier(2);
        var workers = Executors.newFixedThreadPool(2);
        try {
            var a = workers.submit(writer(key, 0, "A", gate));
            var b = workers.submit(writer(key, 0, "B", gate));
            assertNotEquals(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
        } finally { workers.shutdownNow(); }
        assertEquals(1, service.getForAdmin(key).version());
        assertEquals(1, service.versions(key).size());
    }

    private Callable<Boolean> writer(String key, int version, String text, CyclicBarrier gate) {
        return () -> {
            try {
                new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                    // Reproduce a caller's earlier read in the same persistence context, before another writer commits.
                    service.getForAdmin(key);
                    try { gate.await(5, TimeUnit.SECONDS); } catch (Exception e) { throw new RuntimeException(e); }
                    service.upsert(key, value(text), text, version);
                });
                return true;
            } catch (BusinessException conflict) {
                assertEquals("PROMPT_VERSION_CONFLICT", conflict.getCode()); return false;
            }
        };
    }

    @Test void staleRestoreCannotOverwriteCurrentAndFailedTransactionDoesNotEvictCache() {
        String key = "concurrency.restore";
        service.upsert(key, value("first"), "seed", 0);
        service.upsert(key, value("second"), "operator", 1);
        assertEquals("second", service.resolve(key).system());
        assertThrows(BusinessException.class, () -> service.rollback(key, 1, "stale", 1));
        assertEquals(2, service.getForAdmin(key).version());
        assertThrows(IllegalStateException.class, () -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            service.upsert(key, value("aborted"), "operator", 2);
            throw new IllegalStateException("simulate audit failure");
        }));
        assertEquals("second", service.resolve(key).system());
        assertEquals(2, service.versions(key).size());
        var restored = service.rollback(key, 1, "operator", 2);
        assertEquals(3, restored.version()); assertEquals("first", restored.systemPrompt());
        assertEquals("first", service.resolve(key).system());
    }
}
