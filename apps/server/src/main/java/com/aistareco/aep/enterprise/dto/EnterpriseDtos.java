package com.aistareco.aep.enterprise.dto;

import java.time.Instant;
import java.util.List;

/** Mirrors packages/types/src/enterprise.ts. All role/status values use lowercase wire strings. */
public final class EnterpriseDtos {
    private EnterpriseDtos() {}
    public record Capabilities(boolean pointsManage, boolean billingRead, boolean rechargeRequest) {}
    public record Enterprise(String id,String name,String ownerUserId,String status,long version,Instant createdAt,Instant updatedAt) {}
    public record Member(String id,String enterpriseId,String userId,String displayName,String role,String status,Capabilities capabilities,long version,Instant joinedAt) {}
    public record Context(Enterprise enterprise,Member member,List<String> permissions) {}
    public record CreateRequest(String name,String clientRequestId) {}
    public record MemberAddRequest(String phone) {}
    public record MemberBatchAddRequest(List<String> phones) {}
    public record MemberAddResult(String phone,String status,Member member,String errorCode,String message) {}
    public record MemberBatchAddResult(List<MemberAddResult> results,int successCount,int failureCount) {}
    public record InvitationRequest(String clientRequestId,Integer validDays) {
        public InvitationRequest(String clientRequestId) { this(clientRequestId,null); }
    }
    public record Invitation(String id,String enterpriseId,String status,Instant expiresAt) {}
    public record InvitationCreated(Invitation invitation,String token) {}
    public record AcceptRequest(String token) {}
    public record InvitationPreview(String enterpriseId,String enterpriseName,Instant expiresAt) {}
    public record MemberUpdate(String role,Capabilities capabilities,long version) {}
    public record Policy(String enterpriseId,List<String> allowedEndpointIds,int maxActiveJobs,long version) {}
    public record PolicyUpdate(List<String> allowedEndpointIds,int maxActiveJobs,long version) {}
    public record OwnershipRequest(String targetMemberId,String clientRequestId) {}
    public record OwnershipTransfer(String id,String enterpriseId,String fromUserId,String toUserId,String status,Instant expiresAt) {}
    public record Audit(String id,String enterpriseId,String actorUserId,String action,String targetId,String summary,Instant createdAt) {}
}
