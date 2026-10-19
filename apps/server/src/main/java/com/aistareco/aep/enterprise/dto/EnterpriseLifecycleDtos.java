package com.aistareco.aep.enterprise.dto;
import java.util.List;
public final class EnterpriseLifecycleDtos {
    private EnterpriseLifecycleDtos(){}
    public record PreviewRequest(String action,String memberId) {}
    public record Preview(String action,String memberId,long availableCredits,long pendingCredits,int activeJobs,
            int cancellableJobs,int acceptedJobs,boolean canProceed,List<String> blockers,String confirmationFingerprint) {}
    public record Request(String action,String memberId,String clientRequestId,String confirmationFingerprint) {}
    public record Result(String action,String enterpriseId,String memberId,long reclaimedCredits,int cancelledJobs,String status) {}
}
