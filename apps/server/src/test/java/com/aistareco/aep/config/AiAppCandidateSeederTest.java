package com.aistareco.aep.config;

import com.aistareco.aep.model.AiAppBinding;
import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiAppEndpointCandidateRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * D-11 幂等回填 seeder：首启为每条 AiAppBinding 补一条 candidate；重复启动（candidate 已存在）不重复插入。
 */
class AiAppCandidateSeederTest {

    private static AiAppBinding binding(AiModelPurpose purpose, String endpointId) {
        AiAppBinding b = new AiAppBinding();
        b.setPurpose(purpose);
        b.setEndpointId(endpointId);
        return b;
    }

    @Test
    void firstRun_backfills_candidate_for_each_binding() {
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        AiAppEndpointCandidateRepository candidateRepo = mock(AiAppEndpointCandidateRepository.class);
        when(bindingRepo.findAll()).thenReturn(List.of(
                binding(AiModelPurpose.IMAGE_GENERATION, "ep-img"),
                binding(AiModelPurpose.VIDEO_GENERATION, "ep-vid")));
        when(candidateRepo.existsByPurposeAndEndpointId(any(), any())).thenReturn(false);

        new AiAppCandidateSeeder(bindingRepo, candidateRepo).run();

        verify(candidateRepo, times(2)).save(any(AiAppEndpointCandidate.class));
    }

    @Test
    void secondRun_is_idempotent_no_duplicate_insert() {
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        AiAppEndpointCandidateRepository candidateRepo = mock(AiAppEndpointCandidateRepository.class);
        when(bindingRepo.findAll()).thenReturn(List.of(binding(AiModelPurpose.IMAGE_GENERATION, "ep-img")));
        // 候选已存在 → seedIfAbsent 跳过。
        when(candidateRepo.existsByPurposeAndEndpointId(eq(AiModelPurpose.IMAGE_GENERATION), eq("ep-img")))
                .thenReturn(true);

        new AiAppCandidateSeeder(bindingRepo, candidateRepo).run();

        verify(candidateRepo, never()).save(any(AiAppEndpointCandidate.class));
    }
}
