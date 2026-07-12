package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiAppBindingDto;
import com.aistareco.aep.dto.AiAppEndpointCandidateDto;
import com.aistareco.aep.dto.AiAppEndpointCandidateUpsert;
import com.aistareco.aep.dto.EndpointCapabilityDto;
import com.aistareco.aep.model.AiAppBinding;
import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiAppEndpointCandidateRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * AI 应用绑定（v0.41）：每个 {@link AiModelPurpose} 有一个<b>默认</b>端点（{@link AiAppBinding}）。
 * D-11 起同一用途还可挂 N 个<b>候选</b>端点（{@link AiAppEndpointCandidate}，带 capability）；默认端点
 * 始终是候选池的一员（bind 时幂等补一条 candidate，seeder 启动回填历史绑定）。
 * 运行时 {@code AiModelInvocationService.resolveEndpoint} 经此解析端点。
 */
@Service
@Transactional
public class AiAppBindingService {

    private final AiAppBindingRepository bindingRepo;
    private final AiModelEndpointRepository endpointRepo;
    private final AiAppEndpointCandidateRepository candidateRepo;
    private final AiModelInvocationService invocation;

    public AiAppBindingService(AiAppBindingRepository bindingRepo,
                               AiModelEndpointRepository endpointRepo,
                               AiAppEndpointCandidateRepository candidateRepo,
                               AiModelInvocationService invocation) {
        this.bindingRepo = bindingRepo;
        this.endpointRepo = endpointRepo;
        this.candidateRepo = candidateRepo;
        this.invocation = invocation;
    }

    /** 列出全部用途（含未绑定项），各自带绑定端点信息。 */
    @Transactional(readOnly = true)
    public List<AiAppBindingDto> list() {
        List<AiAppBindingDto> out = new ArrayList<>();
        for (AiModelPurpose purpose : AiModelPurpose.values()) {
            AiAppBinding b = bindingRepo.findById(purpose).orElse(null);
            if (b == null) {
                out.add(new AiAppBindingDto(purpose.wire(), purpose.label(), null, null, null, null));
                continue;
            }
            AiModelEndpoint e = endpointRepo.findById(b.getEndpointId()).orElse(null);
            out.add(new AiAppBindingDto(
                    purpose.wire(),
                    purpose.label(),
                    b.getEndpointId(),
                    e != null ? e.getName() : null,
                    e != null ? e.isEnabled() : Boolean.FALSE,
                    b.getUpdatedAt()
            ));
        }
        return out;
    }

    /** 把用途绑定到一个启用端点。同时幂等确保该端点在候选池内（sortOrder=0 置顶）。 */
    public AiAppBindingDto bind(AiModelPurpose purpose, String endpointId) {
        if (endpointId == null || endpointId.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ENDPOINT_ID_REQUIRED", "endpointId 必填");
        }
        AiModelEndpoint e = endpointRepo.findById(endpointId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ENDPOINT_NOT_FOUND",
                        "AI 模型端点不存在"));
        if (!e.isEnabled()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ENDPOINT_DISABLED", "该端点已停用，无法绑定");
        }
        AiAppBinding b = bindingRepo.findById(purpose).orElseGet(() -> {
            AiAppBinding nb = new AiAppBinding();
            nb.setPurpose(purpose);
            return nb;
        });
        b.setEndpointId(endpointId);
        AiAppBinding saved = bindingRepo.save(b);
        // 新默认端点若尚不在候选池 → 幂等补一条（capability 全 null，置顶）。
        ensureCandidate(purpose, endpointId, 0);
        return new AiAppBindingDto(purpose.wire(), purpose.label(), endpointId, e.getName(),
                e.isEnabled(), saved.getUpdatedAt());
    }

    /** 解绑某用途（运行时该用途将报 AI_NOT_CONFIGURED）。候选池不动（历史 capability 保留）。 */
    public void unbind(AiModelPurpose purpose) {
        bindingRepo.deleteById(purpose);
    }

    // ── D-11 候选端点 CRUD ────────────────────────────────────────────────────

    /** 列出某用途全部候选（含 capability + 默认标记），供 admin「候选端点 + 能力」块。 */
    @Transactional(readOnly = true)
    public List<AiAppEndpointCandidateDto> listCandidates(AiModelPurpose purpose) {
        List<AiAppEndpointCandidateDto> out = new ArrayList<>();
        for (ResolvedEndpoint r : invocation.listCandidates(purpose)) {
            out.add(toDto(purpose, r));
        }
        return out;
    }

    /** 新增一个候选端点（endpointId 必填、端点须存在；purpose×endpointId 唯一）。可同时带 capability。 */
    public AiAppEndpointCandidateDto addCandidate(AiModelPurpose purpose, AiAppEndpointCandidateUpsert body) {
        String endpointId = body == null ? null : body.endpointId();
        if (endpointId == null || endpointId.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ENDPOINT_ID_REQUIRED", "endpointId 必填");
        }
        AiModelEndpoint e = endpointRepo.findById(endpointId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ENDPOINT_NOT_FOUND",
                        "AI 模型端点不存在"));
        if (candidateRepo.existsByPurposeAndEndpointId(purpose, endpointId)) {
            throw new BusinessException(HttpStatus.CONFLICT, "CANDIDATE_EXISTS", "该端点已是此用途的候选");
        }
        AiAppEndpointCandidate c = AiAppEndpointCandidate.builder()
                .id(UUID.randomUUID().toString().replace("-", ""))
                .purpose(purpose)
                .endpointId(endpointId)
                .sortOrder(body.sortOrder() != null ? body.sortOrder() : 100)
                .enabled(body.enabled() == null || body.enabled())
                .maxRefImages(body.maxRefImages())
                .supportsFirstLastFrame(body.supportsFirstLastFrame())
                .supportsSubjectReference(body.supportsSubjectReference())
                .maxDurationSec(body.maxDurationSec())
                .creditCostOverride(body.creditCostOverride())
                .build();
        candidateRepo.save(c);
        return toDto(purpose, new ResolvedEndpoint(e, c, isDefault(purpose, endpointId)));
    }

    /**
     * 更新候选的 capability / 单价 override / 启用 / 排序（body 中 null 字段表示不修改）。
     *
     * <p>例行 QA 修复（2026-07-12）：默认候选（{@code isDefault=true}）不允许被禁用。根因——
     * {@link AiModelInvocationService#resolveEndpoint(AiModelPurpose)}（无 endpointId 的默认路径，
     * 覆盖 endpoint_id 未显式指定的绝大多数调用：invokeChat / renderFrame·renderClip 默认分支 /
     * MaterialVideoModelClient.pickEndpoint(null)）只读 {@link AiAppBinding} + 端点自身
     * {@code isEnabled}，从不检查候选行的 {@code enabled} 字段——只有显式传 endpointId 的
     * {@code resolveEndpoint(purpose, endpointId)} 才会校验候选 {@code enabled}。admin「候选端点与
     * 能力」表格此前对默认行和其余行渲染同一个「启用」开关且无任何拦截，运营据此关闭默认行的
     * 「启用」会误以为该端点已停止服务，实际上对占绝大多数流量的默认路径调用完全无效——是一次
     * 静默无效的管理操作。与 {@link #removeCandidate} 已有的「默认候选不许删」同款守卫，这里补齐
     * 「默认候选不许禁用」；需要下线该端点时应先切换默认，或直接停用该 AI 模型端点本身。
     */
    public AiAppEndpointCandidateDto updateCandidate(AiModelPurpose purpose, String endpointId,
                                                     AiAppEndpointCandidateUpsert body) {
        AiAppEndpointCandidate c = candidateRepo.findByPurposeAndEndpointId(purpose, endpointId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "CANDIDATE_NOT_FOUND",
                        "候选端点不存在"));
        if (body != null) {
            if (Boolean.FALSE.equals(body.enabled()) && isDefault(purpose, endpointId)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "CANDIDATE_IS_DEFAULT",
                        "该端点是当前默认端点，禁用候选对默认路径的调用不会生效；请先切换默认端点，或直接停用该 AI 模型端点。");
            }
            if (body.sortOrder() != null) c.setSortOrder(body.sortOrder());
            if (body.enabled() != null) c.setEnabled(body.enabled());
            // capability / override：显式传（含 null 语义「清空为未知」）由 admin 控制；这里整段覆盖。
            c.setMaxRefImages(body.maxRefImages());
            c.setSupportsFirstLastFrame(body.supportsFirstLastFrame());
            c.setSupportsSubjectReference(body.supportsSubjectReference());
            c.setMaxDurationSec(body.maxDurationSec());
            c.setCreditCostOverride(body.creditCostOverride());
        }
        candidateRepo.save(c);
        AiModelEndpoint e = endpointRepo.findById(endpointId).orElse(null);
        return toDto(purpose, new ResolvedEndpoint(e, c, isDefault(purpose, endpointId)));
    }

    /** 删除一个候选端点。默认端点不允许删（先改默认再删）。 */
    public void removeCandidate(AiModelPurpose purpose, String endpointId) {
        if (isDefault(purpose, endpointId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CANDIDATE_IS_DEFAULT",
                    "该端点是当前默认端点，请先切换默认端点再删除。");
        }
        candidateRepo.findByPurposeAndEndpointId(purpose, endpointId)
                .ifPresent(candidateRepo::delete);
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    /** 幂等确保 purpose×endpointId 有一条候选（用于 bind 时把默认端点纳入候选池）。 */
    private void ensureCandidate(AiModelPurpose purpose, String endpointId, int sortOrder) {
        if (candidateRepo.existsByPurposeAndEndpointId(purpose, endpointId)) return;
        AiAppEndpointCandidate c = AiAppEndpointCandidate.builder()
                .id(UUID.randomUUID().toString().replace("-", ""))
                .purpose(purpose)
                .endpointId(endpointId)
                .sortOrder(sortOrder)
                .enabled(true)
                .build();
        candidateRepo.save(c);
    }

    private boolean isDefault(AiModelPurpose purpose, String endpointId) {
        return bindingRepo.findById(purpose).map(b -> endpointId.equals(b.getEndpointId())).orElse(false);
    }

    private static AiAppEndpointCandidateDto toDto(AiModelPurpose purpose, ResolvedEndpoint r) {
        AiModelEndpoint e = r.endpoint();
        AiAppEndpointCandidate c = r.candidate();
        return new AiAppEndpointCandidateDto(
                purpose.wire(),
                purpose.label(),
                c.getEndpointId(),
                e != null ? e.getName() : null,
                e != null ? e.isEnabled() : Boolean.FALSE,
                r.isDefault(),
                c.getSortOrder(),
                c.isEnabled(),
                EndpointCapabilityDto.from(c),
                c.getCreditCostOverride(),
                c.getUpdatedAt()
        );
    }
}
