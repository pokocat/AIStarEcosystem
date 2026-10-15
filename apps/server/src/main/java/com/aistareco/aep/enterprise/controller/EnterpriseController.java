package com.aistareco.aep.enterprise.controller;

import com.aistareco.aep.enterprise.dto.EnterpriseDtos.*;
import com.aistareco.aep.enterprise.service.EnterpriseService;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.common.ApiResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/ip-studio")
@ConditionalOnProperty(name="aep.enterprise.enabled",havingValue="true")
public class EnterpriseController {
    private final EnterpriseService service;
    public EnterpriseController(EnterpriseService service){this.service=service;}
    @PostMapping("/enterprises") public ApiResponse<Context> create(Principal p,@RequestBody CreateRequest r){return ApiResponse.of(service.create(p.getName(),r));}
    @GetMapping("/enterprises") public ApiResponse<List<Context>> mine(Principal p){return ApiResponse.of(service.mine(p.getName()));}
    @GetMapping("/enterprises/{id}") public ApiResponse<Context> context(Principal p,@PathVariable String id){return ApiResponse.of(service.context(p.getName(),id));}
    @GetMapping("/enterprises/{id}/members") public PageEnvelope<Member> members(Principal p,@PathVariable String id,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(service.members(p.getName(),id,page,limit));}
    @PostMapping("/enterprises/{id}/invitations") public ApiResponse<InvitationCreated> invite(Principal p,@PathVariable String id,@RequestBody InvitationRequest r){return ApiResponse.of(service.invite(p.getName(),id,r));}
    @GetMapping("/enterprises/{id}/invitations") public PageEnvelope<Invitation> invitations(Principal p,@PathVariable String id,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(service.invitations(p.getName(),id,page,limit));}
    @DeleteMapping("/enterprises/{id}/invitations/{invitationId}") public ApiResponse<Invitation> revoke(Principal p,@PathVariable String id,@PathVariable String invitationId){return ApiResponse.of(service.revoke(p.getName(),id,invitationId));}
    @PostMapping("/enterprise-invitations/accept") public ApiResponse<Context> accept(Principal p,@RequestBody AcceptRequest r){return ApiResponse.of(service.accept(p.getName(),r));}
    @PatchMapping("/enterprises/{id}/members/{memberId}") public ApiResponse<Member> update(Principal p,@PathVariable String id,@PathVariable String memberId,@RequestBody MemberUpdate r){return ApiResponse.of(service.updateMember(p.getName(),id,memberId,r));}
    @GetMapping("/enterprises/{id}/policy") public ApiResponse<Policy> policy(Principal p,@PathVariable String id){return ApiResponse.of(service.policy(p.getName(),id));}
    @PutMapping("/enterprises/{id}/policy") public ApiResponse<Policy> policy(Principal p,@PathVariable String id,@RequestBody PolicyUpdate r){return ApiResponse.of(service.updatePolicy(p.getName(),id,r));}
    @PostMapping("/enterprises/{id}/ownership-transfers") public ApiResponse<OwnershipTransfer> transfer(Principal p,@PathVariable String id,@RequestBody OwnershipRequest r){return ApiResponse.of(service.requestTransfer(p.getName(),id,r));}
    @GetMapping("/enterprises/{id}/ownership-transfers") public PageEnvelope<OwnershipTransfer> ownershipTransfers(Principal p,@PathVariable String id,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(service.ownershipTransfers(p.getName(),id,page,limit));}
    @PostMapping("/enterprises/{id}/ownership-transfers/{transferId}/accept") public ApiResponse<Context> acceptTransfer(Principal p,@PathVariable String id,@PathVariable String transferId){return ApiResponse.of(service.acceptTransfer(p.getName(),id,transferId));}
    @GetMapping("/enterprises/{id}/audit") public PageEnvelope<Audit> audit(Principal p,@PathVariable String id,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(service.auditPage(p.getName(),id,page,limit));}
}
