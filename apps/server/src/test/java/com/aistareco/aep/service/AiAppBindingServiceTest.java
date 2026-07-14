package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiAppEndpointCandidateDto;
import com.aistareco.aep.dto.AiAppEndpointCandidateUpsert;
import com.aistareco.aep.model.AiAppBinding;
import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiAppEndpointCandidateRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 例行 QA 回归（2026-07-12）：{@link AiAppBindingService#updateCandidate} 不允许禁用默认候选。
 *
 * <p>根因：{@link AiModelInvocationService#resolveEndpoint(AiModelPurpose)}（无 endpointId 的默认路径，
 * 覆盖绝大多数未显式指定 endpoint_id 的调用）只读 {@code AiAppBinding} + 端点自身 {@code isEnabled}，
 * 从不检查候选行的 {@code enabled} 字段——admin 之前可以对默认候选行禁用「启用」开关，误以为端点已
 * 下线，实际上对默认路径调用完全无效（静默无效的管理操作）。本测试锁定：禁用默认候选应被拒绝
 * （与 {@code removeCandidate} 已有的「默认候选不许删」同款守卫），非默认候选禁用不受影响。
 */
class AiAppBindingServiceTest {

    private static AiModelEndpoint endpoint(String id, boolean enabled) {
        return AiModelEndpoint.builder()
                .id(id)
                .name("ep-" + id)
                .providerType(AiModelProviderType.OPENAI)
                .baseUrl("http://127.0.0.1:1/v1")
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("sk-x"))
                .model("m")
                .enabled(enabled)
                .build();
    }

    private static AiAppEndpointCandidate candidate(AiModelPurpose purpose, String endpointId, boolean enabled) {
        AiAppEndpointCandidate c = new AiAppEndpointCandidate();
        c.setId("cand-" + endpointId);
        c.setPurpose(purpose);
        c.setEndpointId(endpointId);
        c.setEnabled(enabled);
        c.setSortOrder(0);
        c.setCreatedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        return c;
    }

    private static AiAppEndpointCandidateUpsert disableBody() {
        return new AiAppEndpointCandidateUpsert(null, null, false, null, null, null, null, null);
    }

    private static AiAppEndpointCandidateUpsert sortOrderOnlyBody(int sortOrder) {
        return new AiAppEndpointCandidateUpsert(null, sortOrder, null, null, null, null, null, null);
    }

    @Test
    void disablingDefaultCandidateIsRejected() {
        AiModelPurpose purpose = AiModelPurpose.VIDEO_GENERATION;
        AiModelEndpointRepository endpointRepo = mock(AiModelEndpointRepository.class);
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        AiAppEndpointCandidateRepository candidateRepo = mock(AiAppEndpointCandidateRepository.class);
        AiModelInvocationService invocation = mock(AiModelInvocationService.class);

        AiAppBinding binding = new AiAppBinding();
        binding.setPurpose(purpose);
        binding.setEndpointId("ep-def");
        when(bindingRepo.findById(purpose)).thenReturn(Optional.of(binding));

        AiAppEndpointCandidate defCandidate = candidate(purpose, "ep-def", true);
        when(candidateRepo.findByPurposeAndEndpointId(purpose, "ep-def")).thenReturn(Optional.of(defCandidate));

        AiAppBindingService svc = new AiAppBindingService(bindingRepo, endpointRepo, candidateRepo, invocation);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.updateCandidate(purpose, "ep-def", disableBody()));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("CANDIDATE_IS_DEFAULT", ex.getCode());

        // 拒绝时不应落库（candidate.enabled 保持 true）。
        assertTrue(defCandidate.isEnabled());
        verify(candidateRepo, never()).save(any());
    }

    @Test
    void disablingNonDefaultCandidateSucceeds() {
        AiModelPurpose purpose = AiModelPurpose.VIDEO_GENERATION;
        AiModelEndpointRepository endpointRepo = mock(AiModelEndpointRepository.class);
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        AiAppEndpointCandidateRepository candidateRepo = mock(AiAppEndpointCandidateRepository.class);
        AiModelInvocationService invocation = mock(AiModelInvocationService.class);

        AiAppBinding binding = new AiAppBinding();
        binding.setPurpose(purpose);
        binding.setEndpointId("ep-def");
        when(bindingRepo.findById(purpose)).thenReturn(Optional.of(binding));

        AiModelEndpoint alt = endpoint("ep-alt", true);
        when(endpointRepo.findById("ep-alt")).thenReturn(Optional.of(alt));
        AiAppEndpointCandidate altCandidate = candidate(purpose, "ep-alt", true);
        when(candidateRepo.findByPurposeAndEndpointId(purpose, "ep-alt")).thenReturn(Optional.of(altCandidate));

        AiAppBindingService svc = new AiAppBindingService(bindingRepo, endpointRepo, candidateRepo, invocation);

        AiAppEndpointCandidateDto dto = svc.updateCandidate(purpose, "ep-alt", disableBody());
        assertFalse(dto.enabled(), "非默认候选允许禁用");
        assertFalse(dto.isDefault());
        verify(candidateRepo).save(altCandidate);
    }

    @Test
    void updatingOtherFieldsOnDefaultCandidateStillWorks() {
        // 不动 enabled（sortOrder-only 更新）不应被默认候选守卫拦下。
        AiModelPurpose purpose = AiModelPurpose.VIDEO_GENERATION;
        AiModelEndpointRepository endpointRepo = mock(AiModelEndpointRepository.class);
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        AiAppEndpointCandidateRepository candidateRepo = mock(AiAppEndpointCandidateRepository.class);
        AiModelInvocationService invocation = mock(AiModelInvocationService.class);

        AiAppBinding binding = new AiAppBinding();
        binding.setPurpose(purpose);
        binding.setEndpointId("ep-def");
        when(bindingRepo.findById(purpose)).thenReturn(Optional.of(binding));

        AiModelEndpoint def = endpoint("ep-def", true);
        when(endpointRepo.findById("ep-def")).thenReturn(Optional.of(def));
        AiAppEndpointCandidate defCandidate = candidate(purpose, "ep-def", true);
        when(candidateRepo.findByPurposeAndEndpointId(purpose, "ep-def")).thenReturn(Optional.of(defCandidate));

        AiAppBindingService svc = new AiAppBindingService(bindingRepo, endpointRepo, candidateRepo, invocation);

        AiAppEndpointCandidateDto dto = svc.updateCandidate(purpose, "ep-def", sortOrderOnlyBody(5));
        assertTrue(dto.enabled(), "未显式禁用时默认候选保持启用");
        assertTrue(dto.isDefault());
        assertEquals(5, dto.sortOrder());
    }

    /**
     * 例行 QA 回归（2026-07-13）：{@link AiAppBindingService#bind} 把一个此前被禁用的候选重新设为默认时，
     * 必须顺带重新启用它，否则会出现「默认候选=disabled」的自相矛盾状态——admin 表格 isDefault 徽章亮着，
     * 「启用」开关却是灭的，且因 updateCandidate 的默认候选守卫（不许禁用默认候选）被锁死，运营无法再
     * 手动打开，只能观测到一个永久卡住的坏状态。
     */
    @Test
    void bindReEnablesPreviouslyDisabledCandidate() {
        AiModelPurpose purpose = AiModelPurpose.VIDEO_GENERATION;
        AiModelEndpointRepository endpointRepo = mock(AiModelEndpointRepository.class);
        AiAppBindingRepository bindingRepo = mock(AiAppBindingRepository.class);
        AiAppEndpointCandidateRepository candidateRepo = mock(AiAppEndpointCandidateRepository.class);
        AiModelInvocationService invocation = mock(AiModelInvocationService.class);

        AiModelEndpoint ep = endpoint("ep-x", true);
        when(endpointRepo.findById("ep-x")).thenReturn(Optional.of(ep));
        when(bindingRepo.findById(purpose)).thenReturn(Optional.empty());
        when(bindingRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        AiAppEndpointCandidate disabled = candidate(purpose, "ep-x", false);
        when(candidateRepo.findByPurposeAndEndpointId(purpose, "ep-x")).thenReturn(Optional.of(disabled));

        AiAppBindingService svc = new AiAppBindingService(bindingRepo, endpointRepo, candidateRepo, invocation);

        svc.bind(purpose, "ep-x");

        assertTrue(disabled.isEnabled(), "被设为默认端点的候选必须重新启用");
        verify(candidateRepo).save(disabled);
    }
}
