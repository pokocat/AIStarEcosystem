package com.aistareco.aep.enterprise.dto;
import java.time.Instant;
public record EnterpriseUsageDto(String id,String enterpriseId,String actorUserId,String actorName,String billingWalletId,
        String referenceType,String referenceId,long cost,long pendingCredits,String status,String modelName,Instant createdAt) {}
