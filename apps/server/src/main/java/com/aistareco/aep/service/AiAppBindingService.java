package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiAppBindingDto;
import com.aistareco.aep.model.AiAppBinding;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * AI 应用绑定（v0.41）：每个 {@link AiModelPurpose} 固定绑一个 {@link AiModelEndpoint}。
 * 运行时 {@code AiModelInvocationService.resolveEndpoint} 经此解析端点。
 */
@Service
@Transactional
public class AiAppBindingService {

    private final AiAppBindingRepository bindingRepo;
    private final AiModelEndpointRepository endpointRepo;

    public AiAppBindingService(AiAppBindingRepository bindingRepo,
                               AiModelEndpointRepository endpointRepo) {
        this.bindingRepo = bindingRepo;
        this.endpointRepo = endpointRepo;
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

    /** 把用途绑定到一个启用端点。 */
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
        return new AiAppBindingDto(purpose.wire(), purpose.label(), endpointId, e.getName(),
                e.isEnabled(), saved.getUpdatedAt());
    }

    /** 解绑某用途（运行时该用途将报 AI_NOT_CONFIGURED）。 */
    public void unbind(AiModelPurpose purpose) {
        bindingRepo.deleteById(purpose);
    }
}
