package com.aistareco.aep.service.materialvideo;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.function.Supplier;

/** Reuse audio receipts only within the same endpoint, credential, model and source key, before supplier expiry. */
@Service
public class MaterialVideoInputAssets {
    public record Receipt(String assetId, Instant expiresAt) {}
    private final MaterialVideoInputAssetRepository repo;
    public MaterialVideoInputAssets(MaterialVideoInputAssetRepository repo) { this.repo = repo; }

    @Transactional
    public Receipt resolve(String endpoint, String baseUrl, String model, String credential, String key,
                           Supplier<Receipt> upload) {
        // Hash the credential as part of the scope, never persist it. Length prefixes avoid ambiguous tuples.
        String id = digest(endpoint, baseUrl, model, credential, key);
        var prior = repo.receipt(id);
        if (!prior.isEmpty() && prior.get(0)[1] instanceof Instant expiry && expiry.isAfter(Instant.now().plusSeconds(60)))
            return new Receipt((String)prior.get(0)[0], expiry);
        Receipt result = upload.get(); // Failed uploads cannot replace the last successful receipt.
        repo.remember(id, key, result.assetId(), result.expiresAt());
        // Missing expiresAt is unknown, not permanent. Such receipts are used once and uploaded again next time.
        return result;
    }

    private static String digest(String... parts) {
        try {
            var hash = MessageDigest.getInstance("SHA-256");
            for (String part : parts) {
                String value = part == null ? "" : part;
                hash.update((value.length() + ":" + value).getBytes(StandardCharsets.UTF_8));
            }
            return HexFormat.of().formatHex(hash.digest());
        } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
