package com.aistareco.aep.service.materialvideo;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:voice-receipts;MODE=MySQL;DB_CLOSE_DELAY=-1"})
@org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase(replace = org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace.NONE)
@Import(MaterialVideoInputAssets.class)
@ActiveProfiles("test")
class MaterialVideoInputAssetsTest {
    @Autowired MaterialVideoInputAssets cache;
    @Autowired MaterialVideoInputAssetRepository repo;

    @Test void persistedReceiptSurvivesNewServiceAndScopeCannotCrossKeyModelOrAccount() {
        AtomicInteger uploads = new AtomicInteger();
        java.util.function.Supplier<MaterialVideoInputAssets.Receipt> upload = () ->
                new MaterialVideoInputAssets.Receipt("a" + uploads.incrementAndGet(), Instant.now().plusSeconds(3600));
        assertEquals("a1", cache.resolve("ep", "base", "h3", "key-a", "owner/voice", upload).assetId());
        repo.flush();
        assertEquals("a1", new MaterialVideoInputAssets(repo).resolve("ep", "base", "h3", "key-a", "owner/voice", upload).assetId());
        assertEquals("a2", cache.resolve("ep", "base", "h3", "key-b", "owner/voice", upload).assetId());
        assertEquals("a3", cache.resolve("ep", "base", "other", "key-a", "owner/voice", upload).assetId());
        assertEquals("a4", cache.resolve("ep", "base", "h3", "key-a", "other-owner/voice", upload).assetId());
        assertEquals("a5", cache.resolve("ep", "other-base", "h3", "key-a", "owner/voice", upload).assetId());
        assertEquals("a6", cache.resolve("other-ep", "base", "h3", "key-a", "owner/voice", upload).assetId());
        assertEquals(6, uploads.get());
    }
    @Test void expiredAndUnknownReceiptsAreRenewedAndFailureCannotReplaceThem() {
        cache.resolve("ep", "base", "h3", "key", "voice", () -> new MaterialVideoInputAssets.Receipt("old", Instant.now().minusSeconds(1)));
        assertThrows(IllegalStateException.class, () -> cache.resolve("ep", "base", "h3", "key", "voice", () -> { throw new IllegalStateException("supplier failed"); }));
        assertEquals("old", repo.findAll().get(0).getAssetId());
        cache.resolve("ep", "base", "h3", "key", "voice", () -> new MaterialVideoInputAssets.Receipt("unknown", null));
        assertEquals("renewed", cache.resolve("ep", "base", "h3", "key", "voice", () -> new MaterialVideoInputAssets.Receipt("renewed", Instant.now().plusSeconds(3600))).assetId());
    }
}
