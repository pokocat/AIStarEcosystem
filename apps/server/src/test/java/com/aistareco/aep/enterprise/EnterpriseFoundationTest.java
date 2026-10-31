package com.aistareco.aep.enterprise;

import com.aistareco.aep.enterprise.dto.EnterpriseDtos.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.enterprise.service.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.enrollment.model.ProductEnrollment.*;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false","aep.cdn.driver=local","aep.enterprise.enabled=true",
        "aep.dev-auth.enabled=false","aep.dev-fake-llm.enabled=false"})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class EnterpriseFoundationTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        String url=System.getProperty("enterprise.test.jdbc","jdbc:h2:mem:enterprise-foundation;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000");
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.driver-class-name",()->url.startsWith("jdbc:mysql:")?"com.mysql.cj.jdbc.Driver":"org.h2.Driver");
        registry.add("spring.datasource.username",()->url.startsWith("jdbc:mysql:")?"root":"sa");
        registry.add("spring.datasource.password",()->"");
    }
    @Autowired EnterpriseService service;
    @Autowired EnterpriseMemberBatchService batchService;
    @Autowired EnterpriseAccessService access;
    @Autowired AepUserRepository users;
    @Autowired EnrollmentService enrollment;
    @Autowired EnterpriseRepository enterprises;
    @Autowired EnterpriseCurrentMembershipRepository current;
    @Autowired EnterpriseInvitationRepository invitations;
    @Autowired EnterpriseMemberRepository members;
    @Autowired CreditService credits;
    @Autowired WalletRepository wallets;
    @Autowired CreditHoldRepository holds;
    @Autowired LedgerEntryRepository ledger;
    @Autowired AdminFinanceService finance;
    @Autowired MockMvc mvc;
    private String person(boolean enrolled) {
        String id=UUID.randomUUID().toString();
        users.save(AepUser.builder().id(id).username(id).displayName("验收成员").status(AepUser.UserStatus.ACTIVE)
                .kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        if(enrolled)enrollment.upsert(id,"aiavatar",EnrollmentStatus.ACTIVE,EnrollmentSource.ADMIN,null);
        return id;
    }
    private Context company(String owner){return service.create(owner,new CreateRequest("验收企业",UUID.randomUUID().toString()));}
    private Context join(String owner,Context e,String person) {
        var invitation=service.invite(owner,e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        return service.accept(person,new AcceptRequest(invitation.token()));
    }
    private static final java.util.concurrent.atomic.AtomicLong phoneSequence=new java.util.concurrent.atomic.AtomicLong(10000000);
    private String phoneFor(String id) {
        var user=users.findById(id).orElseThrow();String phone="139"+phoneSequence.incrementAndGet();
        user.setPhone(phone);users.saveAndFlush(user);return phone;
    }
    @Test void phoneAdditionIsIdempotentLeastPrivilegeAndPreservesPersonalFunds() throws Exception {
        String owner=person(true),target=person(true);var e=company(owner);String phone=phoneFor(target);
        credits.creditAccount(target,777,LedgerEntry.LedgerEntryType.GIFT,"test",target,"个人余额");
        var added=service.addMember(owner,e.enterprise().id(),new MemberAddRequest("+86 "+phone));
        assertEquals(target,added.userId());assertEquals("member",added.role());
        assertEquals(new Capabilities(false,false,false),added.capabilities());
        assertEquals(added.id(),service.addMember(owner,e.enterprise().id(),new MemberAddRequest(phone)).id());
        assertEquals(2,service.members(owner,e.enterprise().id(),0,20).getTotalElements());
        assertEquals(0,wallets.findByAccountKey("enterprise_member:"+e.enterprise().id()+":"+target).orElseThrow().getTotalBalance());
        assertEquals(777,wallets.findByUserId(target).orElseThrow().getTotalBalance());
        mvc.perform(post("/api/v1/ip-studio/enterprises/"+e.enterprise().id()+"/members").with(user(owner).roles("PERSONAL"))
                .contentType("application/json").content("{\"phone\":\""+phone+"\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(added.id()))
                .andExpect(jsonPath("$.data.phone").doesNotExist());
        var audit=service.auditPage(owner,e.enterprise().id(),0,20);
        assertEquals(1,audit.stream().filter(a->"member.add".equals(a.action())).count());
        assertFalse(audit.stream().anyMatch(a->a.summary().contains(phone)));
    }
    @Test void phoneAdditionChecksPermissionValidationPhoneAndEnrollment() throws Exception {
        String owner=person(true),member=person(true),target=person(false);var e=company(owner);join(owner,e,member);
        String phone=phoneFor(target),id=e.enterprise().id();
        assertEquals("ENTERPRISE_PERMISSION_DENIED",assertThrows(BusinessException.class,()->service.addMember(member,id,new MemberAddRequest(phone))).getCode());
        assertEquals("ENTERPRISE_INPUT_INVALID",assertThrows(BusinessException.class,()->service.addMember(owner,id,new MemberAddRequest("123"))).getCode());
        assertEquals("ENTERPRISE_ACCOUNT_NOT_FOUND",assertThrows(BusinessException.class,()->service.addMember(owner,id,new MemberAddRequest("13800009999"))).getCode());
        assertEquals("PRODUCT_NOT_ENROLLED",assertThrows(BusinessException.class,()->service.addMember(owner,id,new MemberAddRequest(phone))).getCode());
        assertFalse(current.existsById(target));assertFalse(enrollment.isActive(target,"aiavatar"));
        var user=users.findById(target).orElseThrow();user.setPhoneVerified(false);users.saveAndFlush(user);
        assertEquals("ENTERPRISE_PHONE_UNVERIFIED",assertThrows(BusinessException.class,()->service.addMember(owner,id,new MemberAddRequest(phone))).getCode());
        mvc.perform(post("/api/v1/ip-studio/enterprises/"+id+"/members").contentType("application/json").content("{\"phone\":\""+phone+"\"}")).andExpect(status().isUnauthorized());
    }
    @Test void phoneAdditionAllowsManagersButDoesNotRestoreSuspendedMembers() {
        String owner=person(true),manager=person(true),target=person(true);var e=company(owner);var m=join(owner,e,manager);
        service.updateMember(owner,e.enterprise().id(),m.member().id(),new MemberUpdate("manager",new Capabilities(false,false,false),m.member().version()));
        String phone=phoneFor(target);var added=service.addMember(manager,e.enterprise().id(),new MemberAddRequest(phone));
        var row=members.findById(added.id()).orElseThrow();row.setStatus("suspended");members.saveAndFlush(row);
        assertEquals("ENTERPRISE_MEMBER_INACTIVE",assertThrows(BusinessException.class,()->service.addMember(owner,e.enterprise().id(),new MemberAddRequest(phone))).getCode());
        assertEquals("suspended",members.findById(added.id()).orElseThrow().getStatus());
    }
    @Test void concurrentPhoneAdditionAndInvitationCannotJoinTwoCompanies() throws Exception {
        String a=person(true),b=person(true),target=person(true);var ea=company(a);var eb=company(b);String phone=phoneFor(target);
        var invite=service.invite(b,eb.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        assertEquals(1,race(()->{service.addMember(a,ea.enterprise().id(),new MemberAddRequest(phone));return true;},()->{service.accept(target,new AcceptRequest(invite.token()));return true;}).stream().filter(Boolean::booleanValue).count());
        String joined=current.findById(target).orElseThrow().getEnterpriseId();
        String other=joined.equals(ea.enterprise().id())?eb.enterprise().id():ea.enterprise().id();
        String otherOwner=joined.equals(ea.enterprise().id())?b:a;
        assertEquals("ENTERPRISE_ALREADY_JOINED",assertThrows(BusinessException.class,()->service.addMember(otherOwner,other,new MemberAddRequest(phone))).getCode());
    }
    @Test void batchAdditionCommitsEachPhoneIndependentlyAndDeduplicates() throws Exception {
        String owner=person(true),a=person(true),b=person(false);var e=company(owner);
        String pa=phoneFor(a),pb=phoneFor(b);long before=members.count();
        var result=batchService.addMembers(owner,e.enterprise().id(),new MemberBatchAddRequest(List.of(pa,pb,"invalid","+86 "+pa)));
        assertEquals(1,result.successCount());assertEquals(2,result.failureCount());assertEquals(3,result.results().size());
        assertTrue(current.existsById(a));assertFalse(current.existsById(b));assertEquals(before+1,members.count());
        assertEquals("PRODUCT_NOT_ENROLLED",result.results().get(1).errorCode());
        assertEquals("ENTERPRISE_INPUT_INVALID",result.results().get(2).errorCode());
        var replay=batchService.addMembers(owner,e.enterprise().id(),new MemberBatchAddRequest(List.of(pa)));
        assertEquals(1,replay.successCount());assertEquals(before+1,members.count());
        mvc.perform(post("/api/v1/ip-studio/enterprises/"+e.enterprise().id()+"/members/batch").with(user(owner).roles("PERSONAL"))
                .contentType("application/json").content("{\"phones\":[\""+pa+"\"]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.successCount").value(1));
    }
    @Test void batchAdditionRequiresInvitePermissionAndBoundsTheRequest() {
        String owner=person(true),member=person(true);var e=company(owner);join(owner,e,member);
        assertEquals("ENTERPRISE_PERMISSION_DENIED",assertThrows(BusinessException.class,()->batchService.addMembers(member,e.enterprise().id(),new MemberBatchAddRequest(List.of("13800138000")))).getCode());
        assertThrows(BusinessException.class,()->batchService.addMembers(owner,e.enterprise().id(),new MemberBatchAddRequest(List.of())));
        assertThrows(BusinessException.class,()->batchService.addMembers(owner,e.enterprise().id(),new MemberBatchAddRequest(Collections.nCopies(101,"13800138000"))));
    }
    @Test void creationIsIdempotentAndDoesNotChangePersonalFundsOrEnrollment() {
        String owner=person(true);credits.creditAccount(owner,777,LedgerEntry.LedgerEntryType.GIFT,"test",owner,"旧个人余额");
        String key=UUID.randomUUID().toString();var a=service.create(owner,new CreateRequest("企业甲",key));
        var b=service.create(owner,new CreateRequest("企业甲",key));assertEquals(a.enterprise().id(),b.enterprise().id());
        assertThrows(BusinessException.class,()->service.create(owner,new CreateRequest("企业乙",key)));
        assertEquals("owner",a.member().role());assertTrue(a.permissions().contains("ownership.transfer"));
        assertEquals(777,wallets.findByUserId(owner).orElseThrow().getTotalBalance());
        var root=wallets.findByAccountKey("enterprise:"+a.enterprise().id()).orElseThrow();assertNull(root.getUserId());assertEquals(0,root.getTotalBalance());
        assertTrue(enrollment.isActive(owner,"aiavatar"));assertFalse(enrollment.isActive(owner,"music"));
    }
    @Test void groupInvitationsAreReusableHashedLongLivedAndRevocable() {
        String owner=person(true),a=person(true),b=person(true);var e=company(owner);var key=UUID.randomUUID().toString();
        var invite=service.invite(owner,e.enterprise().id(),new InvitationRequest(key));
        assertNotEquals(invite.token(),invitations.findById(invite.invitation().id()).orElseThrow().getTokenHash());
        assertNull(service.invite(owner,e.enterprise().id(),new InvitationRequest(key)).token());
        var joined=service.accept(a,new AcceptRequest(invite.token()));assertEquals("member",joined.member().role());
        assertEquals(joined.member().id(),service.accept(a,new AcceptRequest(invite.token())).member().id());
        assertEquals(e.enterprise().id(),service.accept(b,new AcceptRequest(invite.token())).enterprise().id());
        assertEquals("pending",invitations.findById(invite.invitation().id()).orElseThrow().getStatus());
        assertTrue(invite.invitation().expiresAt().isAfter(Instant.now().plus(java.time.Duration.ofDays(89))));
        var revoked=service.invite(owner,e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        service.revoke(owner,e.enterprise().id(),revoked.invitation().id());
        assertThrows(BusinessException.class,()->service.accept(b,new AcceptRequest(revoked.token())));
    }
    @Test void groupInvitationsSupportOneYearAndBindDurationToIdempotencyKey() {
        String owner=person(true);var e=company(owner);String key=UUID.randomUUID().toString();
        var i=service.invite(owner,e.enterprise().id(),new InvitationRequest(key,365));
        assertTrue(i.invitation().expiresAt().isAfter(Instant.now().plus(java.time.Duration.ofDays(364))));
        assertNull(service.invite(owner,e.enterprise().id(),new InvitationRequest(key,365)).token());
        assertThrows(BusinessException.class,()->service.invite(owner,e.enterprise().id(),new InvitationRequest(key,90)));
        assertThrows(BusinessException.class,()->service.invite(owner,e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString(),0)));
    }
    @Test void invitationPreviewIsAnonymousReadOnlyAndContainsNoMemberOrWalletData() throws Exception {
        String owner=person(true);var e=company(owner);var i=service.invite(owner,e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        long before=members.count();String body=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(new AcceptRequest(i.token()));
        mvc.perform(post("/api/v1/ip-studio/enterprise-invitations/preview").contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("$.data.enterpriseName").value(e.enterprise().name()))
                .andExpect(jsonPath("$.data.ownerUserId").doesNotExist()).andExpect(jsonPath("$.data.token").doesNotExist())
                .andExpect(jsonPath("$.data.balance").doesNotExist());
        assertEquals(before,members.count());assertEquals("pending",invitations.findById(i.invitation().id()).orElseThrow().getStatus());
        mvc.perform(post("/api/v1/ip-studio/enterprise-invitations/accept").contentType("application/json").content(body)).andExpect(status().isUnauthorized());
        service.revoke(owner,e.enterprise().id(),i.invitation().id());
        mvc.perform(post("/api/v1/ip-studio/enterprise-invitations/preview").contentType("application/json").content(body))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("ENTERPRISE_INVITATION_INVALID"));
    }
    @Test void invalidExpiredAndUnauthorizedInviterCannotBePreviewed() {
        String owner=person(true);var e=company(owner);var i=service.invite(owner,e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        assertThrows(BusinessException.class,()->service.previewInvitation(new AcceptRequest("unknown-token")));
        var row=invitations.findById(i.invitation().id()).orElseThrow();row.setExpiresAt(Instant.EPOCH);invitations.saveAndFlush(row);
        assertThrows(BusinessException.class,()->service.previewInvitation(new AcceptRequest(i.token())));
        var next=service.invite(owner,e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        enrollment.upsert(owner,"aiavatar",EnrollmentStatus.REVOKED,EnrollmentSource.ADMIN,null);
        assertThrows(BusinessException.class,()->service.previewInvitation(new AcceptRequest(next.token())));
    }
    @Test void enrollmentRemainsRequiredAndInvitationDoesNotGrantAccess() {
        String owner=person(true),unopened=person(false);var e=company(owner);
        var i=service.invite(owner,e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        var failure=assertThrows(BusinessException.class,()->service.accept(unopened,new AcceptRequest(i.token())));
        assertEquals("PRODUCT_NOT_ENROLLED",failure.getCode());assertFalse(current.existsById(unopened));assertFalse(enrollment.isActive(unopened,"aiavatar"));
    }
    @Test void rolesCannotEscalateAndForeignResourcesAreDenied() throws Exception {
        String owner=person(true),manager=person(true),member=person(true),outsider=person(true);var e=company(owner);
        var m=join(owner,e,manager);var n=join(owner,e,member);String id=e.enterprise().id();
        var promoted=service.updateMember(owner,id,m.member().id(),new MemberUpdate("manager",new Capabilities(true,true,true),m.member().version()));
        assertTrue(access.require(manager,id,"points.manage").isPointsManage());
        assertThrows(BusinessException.class,()->service.updateMember(manager,id,promoted.id(),new MemberUpdate("manager",new Capabilities(true,true,true),promoted.version())));
        assertThrows(BusinessException.class,()->access.requireOrdinaryTarget(manager,id,promoted.id()));
        assertThrows(BusinessException.class,()->service.updateMember(owner,id,n.member().id(),new MemberUpdate("member",new Capabilities(true,false,false),n.member().version())));
        mvc.perform(get("/api/v1/ip-studio/enterprises/"+id).with(user(outsider).roles("PERSONAL"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/ip-studio/enterprises/"+id+"/members").with(user(owner).roles("PERSONAL")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray()).andExpect(jsonPath("$.pagination.total").value(3));
        mvc.perform(get("/api/admin/finance/recharge-orders").with(user(owner).roles("PERSONAL"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/ip-studio/enterprises/"+id)).andExpect(status().isUnauthorized());
    }
    @Test void ownershipRequiresReceiverAcceptanceAndHasExactlyOneOwner() {
        String owner=person(true),receiver=person(true);var e=company(owner);var m=join(owner,e,receiver);String id=e.enterprise().id();
        var t=service.requestTransfer(owner,id,new OwnershipRequest(m.member().id(),UUID.randomUUID().toString()));
        assertEquals(owner,enterprises.findById(id).orElseThrow().getOwnerUserId());
        assertThrows(BusinessException.class,()->service.acceptTransfer(owner,id,t.id()));
        var after=service.acceptTransfer(receiver,id,t.id());assertEquals(receiver,after.enterprise().ownerUserId());
        assertEquals("manager",service.context(owner,id).member().role());assertFalse(service.context(owner,id).permissions().contains("ownership.transfer"));
        assertEquals(receiver,service.acceptTransfer(receiver,id,t.id()).enterprise().ownerUserId());
        String creationKey=enterprises.findById(id).orElseThrow().getCreateRequestId();
        assertEquals(id,service.create(owner,new CreateRequest("验收企业",creationKey)).enterprise().id());
    }
    @Test void competingOwnershipAcceptancesLeaveOneOwner()throws Exception {
        String owner=person(true),a=person(true),b=person(true);var e=company(owner);var ma=join(owner,e,a);var mb=join(owner,e,b);String id=e.enterprise().id();
        var ta=service.requestTransfer(owner,id,new OwnershipRequest(ma.member().id(),UUID.randomUUID().toString()));
        var tb=service.requestTransfer(owner,id,new OwnershipRequest(mb.member().id(),UUID.randomUUID().toString()));
        assertEquals(1,race(()->{service.acceptTransfer(a,id,ta.id());return true;},()->{service.acceptTransfer(b,id,tb.id());return true;}).stream().filter(Boolean::booleanValue).count());
        String winner=enterprises.findById(id).orElseThrow().getOwnerUserId();
        assertEquals(1,service.members(winner,id,0,20).stream().filter(m->"owner".equals(m.role())).count());
    }
    @Test void concurrentInvitationsCannotJoinTwoCompanies() throws Exception {
        String a=person(true),b=person(true),target=person(true);var ea=company(a);var eb=company(b);
        var ia=service.invite(a,ea.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        var ib=service.invite(b,eb.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        List<Boolean> result=race(()->{service.accept(target,new AcceptRequest(ia.token()));return true;},()->{service.accept(target,new AcceptRequest(ib.token()));return true;});
        assertEquals(1,result.stream().filter(Boolean::booleanValue).count());assertTrue(current.existsById(target));
    }
    @Test void concurrentUsersCanJoinThroughTheSameGroupInvitation() throws Exception {
        String owner=person(true),a=person(true),b=person(true);var e=company(owner);
        var i=service.invite(owner,e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        assertEquals(2,race(()->{service.accept(a,new AcceptRequest(i.token()));return true;},()->{service.accept(b,new AcceptRequest(i.token()));return true;}).stream().filter(Boolean::booleanValue).count());
    }
    @Test void enterpriseHoldUsesWalletIdentityAndPreservesBuckets() {
        String owner=person(true);var e=company(owner);var w=wallets.findByAccountKey("enterprise_member:"+e.enterprise().id()+":"+owner).orElseThrow();
        credits.creditWallet(w.getId(),60,LedgerEntry.LedgerEntryType.GIFT,"test","g","赠额");
        credits.creditWallet(w.getId(),140,LedgerEntry.LedgerEntryType.RECHARGE,"test","r","实收");
        String ref=UUID.randomUUID().toString();var h=credits.holdWallet(w.getId(),100,"enterprise_test",ref,"生成",owner,e.member().id(),"auth-"+ref, com.aistareco.aep.billing.service.ModelChargeContext.NONE);
        assertNull(h.getUserId());assertEquals(e.enterprise().id(),h.getEnterpriseId());
        assertEquals(h.getId(),credits.holdWallet(w.getId(),100,"enterprise_test",ref,"重试",owner,e.member().id(),"auth-"+ref, com.aistareco.aep.billing.service.ModelChargeContext.NONE).getId());
        assertThrows(ResponseStatusException.class,()->credits.holdWallet(w.getId(),90,"enterprise_test",ref,"改金额",owner,e.member().id(),"auth-"+ref, com.aistareco.aep.billing.service.ModelChargeContext.NONE));
        credits.commitHold("enterprise_test",ref,40,"部分成功", null);credits.releaseHold("enterprise_test",ref,"释放余量");
        var after=wallets.findById(w.getId()).orElseThrow();assertEquals(160,after.getTotalBalance());assertEquals(0,after.getPendingBalance());
        assertEquals(36,after.getGiftBalance());assertEquals(124,after.getRechargeBalance());assertNull(credits.releaseHold("enterprise_test",ref,"重复释放"));
        assertNotNull(credits.listWallets(org.springframework.data.domain.PageRequest.of(0,100)));
        assertNotNull(credits.listLedgerEntries(w.getId(),null,org.springframework.data.domain.PageRequest.of(0,100)));
        assertNotNull(finance.listTransactions(0,100,null));
    }
    @Test void personalAndCorporateReferencesCannotCrossAndMasterCannotSpend() {
        String owner=person(true);var e=company(owner);credits.creditAccount(owner,100,LedgerEntry.LedgerEntryType.GIFT,"test",owner,"个人");
        String ref=UUID.randomUUID().toString();credits.hold(owner,10,"cross",ref,"个人冻结", com.aistareco.aep.billing.service.ModelChargeContext.NONE);
        var member=wallets.findByAccountKey("enterprise_member:"+e.enterprise().id()+":"+owner).orElseThrow();
        assertThrows(ResponseStatusException.class,()->credits.holdWallet(member.getId(),10,"cross",ref,"串账户",owner,e.member().id(),"auth", com.aistareco.aep.billing.service.ModelChargeContext.NONE));
        var master=wallets.findByAccountKey("enterprise:"+e.enterprise().id()).orElseThrow();
        assertThrows(ResponseStatusException.class,()->credits.holdWallet(master.getId(),1,"bad","r","主账户",owner,null,null, com.aistareco.aep.billing.service.ModelChargeContext.NONE));
    }
    @Test void concurrentCorporateHoldsCannotOverspend()throws Exception {
        String owner=person(true);var e=company(owner);var w=wallets.findByAccountKey("enterprise_member:"+e.enterprise().id()+":"+owner).orElseThrow();
        credits.creditWallet(w.getId(),100,LedgerEntry.LedgerEntryType.GIFT,"test",owner,"并发验收");
        Callable<Boolean> submit=()->{try{String ref=UUID.randomUUID().toString();credits.holdWallet(w.getId(),80,"race",ref,"并发",owner,e.member().id(),ref, com.aistareco.aep.billing.service.ModelChargeContext.NONE);return true;}catch(ResponseStatusException ex){assertEquals(402,ex.getStatusCode().value());return false;}};
        assertEquals(1,race(submit,submit).stream().filter(Boolean::booleanValue).count());
        var after=wallets.findById(w.getId()).orElseThrow();assertEquals(20,after.getTotalBalance());assertEquals(80,after.getPendingBalance());
    }
    @Test void transferEntriesAreNotNewRevenue() {
        long before=ledger.sumTotalCreditsIssued();
        var entry=LedgerEntry.builder().id(UUID.randomUUID().toString()).walletId("fixture-wallet").entryType(LedgerEntry.LedgerEntryType.TRANSFER_IN)
                .amount(100).balanceAfter(100).referenceType("enterprise_transfer").referenceId(UUID.randomUUID().toString()).createdAt(Instant.now()).build();
        entry=ledger.saveAndFlush(entry);assertEquals(before,ledger.sumTotalCreditsIssued());assertEquals(LedgerEntry.Plane.CREDIT,entry.getPlane());assertNull(entry.getCashArtifactId());
    }
    @Test void policyPermissionsAndVersionsAreChecked() {
        String owner=person(true),member=person(true);var e=company(owner);join(owner,e,member);String id=e.enterprise().id();
        var before=service.policy(owner,id);var after=service.updatePolicy(owner,id,new PolicyUpdate(List.of(),2,before.version()));
        assertEquals(2,after.maxActiveJobs());assertTrue(after.version()>before.version());
        assertThrows(BusinessException.class,()->service.updatePolicy(owner,id,new PolicyUpdate(List.of(),3,before.version())));
        assertThrows(BusinessException.class,()->service.updatePolicy(member,id,new PolicyUpdate(List.of(),3,after.version())));
    }
    @Test void invitationExpiryAndSuspendedMembershipRevokeAuthority() {
        String owner=person(true),member=person(true);var e=company(owner);var i=service.invite(owner,e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString()));
        var row=invitations.findById(i.invitation().id()).orElseThrow();row.setExpiresAt(Instant.EPOCH);invitations.saveAndFlush(row);
        assertThrows(BusinessException.class,()->service.accept(member,new AcceptRequest(i.token())));
        var joined=join(owner,e,member);var m=members.findById(joined.member().id()).orElseThrow();m.setStatus("suspended");members.saveAndFlush(m);
        assertEquals("suspended",service.context(member,e.enterprise().id()).member().status());
        assertEquals(List.of("enterprise.read"),service.context(member,e.enterprise().id()).permissions());
        assertThrows(BusinessException.class,()->service.invite(member,e.enterprise().id(),new InvitationRequest(UUID.randomUUID().toString())));
        assertThrows(BusinessException.class,()->service.members(member,e.enterprise().id(),0,20));
        assertTrue(current.existsById(member));assertTrue(enrollment.isActive(member,"aiavatar"));
    }
    private List<Boolean> race(Callable<Boolean> first,Callable<Boolean> second)throws Exception {
        var pool=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
        try {List<Future<Boolean>> futures=new ArrayList<>();for(var call:List.of(first,second))futures.add(pool.submit(()->{start.await();try{return call.call();}catch(BusinessException e){return false;}}));start.countDown();return List.of(futures.get(0).get(30,TimeUnit.SECONDS),futures.get(1).get(30,TimeUnit.SECONDS));}
        finally{pool.shutdownNow();}
    }
}
