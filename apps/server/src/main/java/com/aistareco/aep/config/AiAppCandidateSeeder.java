package com.aistareco.aep.config;

import com.aistareco.aep.model.AiAppBinding;
import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiAppEndpointCandidateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * D-11 幂等回填：为每条已有 {@link AiAppBinding}（默认端点）确保候选池里有一条对应
 * {@link AiAppEndpointCandidate}（{@code purpose+endpointId}，sortOrder=0 置顶，capability 全 null）。
 *
 * <p>让历史绑定自动进入候选池，admin UI 立即可见、{@code resolveEndpoint(purpose,endpointId)} 白名单可命中，
 * 无需人工。跑在 {@link AiModelEndpointBindingSeeder}(@Order 55) / {@code DevFakeAiSeeder}(@Order 56) 之后，
 * 确保绑定已就位。重复启动 seedIfAbsent → 不重复插入。
 */
@Component
@Order(60)
public class AiAppCandidateSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AiAppCandidateSeeder.class);

    private final AiAppBindingRepository bindingRepo;
    private final AiAppEndpointCandidateRepository candidateRepo;

    public AiAppCandidateSeeder(AiAppBindingRepository bindingRepo,
                                AiAppEndpointCandidateRepository candidateRepo) {
        this.bindingRepo = bindingRepo;
        this.candidateRepo = candidateRepo;
    }

    @Override
    public void run(String... args) {
        int created = 0;
        try {
            for (AiAppBinding b : bindingRepo.findAll()) {
                if (b.getEndpointId() == null || b.getEndpointId().isBlank()) continue;
                if (candidateRepo.existsByPurposeAndEndpointId(b.getPurpose(), b.getEndpointId())) continue;
                AiAppEndpointCandidate c = AiAppEndpointCandidate.builder()
                        .id(UUID.randomUUID().toString().replace("-", ""))
                        .purpose(b.getPurpose())
                        .endpointId(b.getEndpointId())
                        .sortOrder(0) // 默认端点置顶
                        .enabled(true)
                        .build();
                candidateRepo.save(c);
                created++;
            }
        } catch (Exception e) {
            log.warn("[ai-candidate-seed] backfill failed: {}", e.getMessage());
            return;
        }
        if (created > 0) log.info("[ai-candidate-seed] backfilled {} default-endpoint candidate(s)", created);
    }
}
