package com.aistareco.aep.enterprise.service;

import com.aistareco.aep.enterprise.model.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.*;

/** Product-scoped RBAC. Platform operator roles never imply enterprise membership. */
@Service
public class EnterpriseAccessService {
    private final EnterpriseRepository enterprises;
    private final EnterpriseMemberRepository members;
    private final EnterpriseCurrentMembershipRepository current;
    private final AepUserRepository users;
    private final EnrollmentService enrollment;
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
    public EnterpriseAccessService(EnterpriseRepository enterprises,EnterpriseMemberRepository members,
            EnterpriseCurrentMembershipRepository current,AepUserRepository users,EnrollmentService enrollment) {
        this.enterprises=enterprises;this.members=members;this.current=current;this.users=users;this.enrollment=enrollment;
    }
    public void requireUser(String userId) {
        AepUser user=users.findById(userId).orElseThrow(()->denied("ENTERPRISE_ACCESS_DENIED","请先登录"));
        if(user.getStatus()!=AepUser.UserStatus.ACTIVE) throw denied("ACCOUNT_STATE_INVALID","账号当前不可使用");
        if(!enrollment.isActive(userId,"aiavatar")) throw denied("PRODUCT_NOT_ENROLLED","请先开通数字资产平台");
    }
    public EnterpriseMember member(String userId,String enterpriseId) {
        requireUser(userId);
        Enterprise e=enterprises.findById(enterpriseId).orElseThrow(()->denied("ENTERPRISE_ACCESS_DENIED","无法访问该企业"));
        EnterpriseCurrentMembership c=current.findById(userId).filter(x->enterpriseId.equals(x.getEnterpriseId()))
                .orElseThrow(()->denied("ENTERPRISE_ACCESS_DENIED","无法访问该企业"));
        return members.findById(c.getMemberId()).filter(m->"active".equals(m.getStatus()) && enterpriseId.equals(m.getEnterpriseId()) && userId.equals(m.getUserId()) && "active".equals(e.getStatus()))
                .orElseThrow(()->denied("ENTERPRISE_MEMBER_INACTIVE","当前成员不可使用企业功能"));
    }
    public EnterpriseMember require(String userId,String enterpriseId,String permission) {
        EnterpriseMember m=member(userId,enterpriseId);
        Enterprise e=enterprises.findById(enterpriseId).orElseThrow();
        if(!permissions(e,m).contains(permission)) throw denied("ENTERPRISE_PERMISSION_DENIED","没有此项企业操作权限");
        return m;
    }
    /** Suspension revokes spending/management, but does not hide the person's own enterprise balance or exit action. */
    public EnterpriseMember readMember(String userId,String enterpriseId) {
        requireUser(userId);
        var e=enterprises.findById(enterpriseId).orElseThrow(()->denied("ENTERPRISE_ACCESS_DENIED","无法访问该企业"));
        var c=current.findById(userId).filter(x->enterpriseId.equals(x.getEnterpriseId()))
                .orElseThrow(()->denied("ENTERPRISE_ACCESS_DENIED","无法访问该企业"));
        return members.findById(c.getMemberId()).filter(m->!"removed".equals(m.getStatus())&&!"closed".equals(e.getStatus())
                &&enterpriseId.equals(m.getEnterpriseId())&&userId.equals(m.getUserId()))
                .orElseThrow(()->denied("ENTERPRISE_MEMBER_INACTIVE","成员关系已结束"));
    }
    /** Called after the enterprise lock; MySQL REPEATABLE READ must not reuse an older membership snapshot. */
    public EnterpriseMember memberForUpdate(String userId,String enterpriseId) {
        requireUser(userId);
        var e=enterprises.lockById(enterpriseId).orElseThrow(()->denied("ENTERPRISE_ACCESS_DENIED","无法访问该企业"));
        entityManager.refresh(e,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        var relation=current.findCurrentForUpdate(userId).filter(c->enterpriseId.equals(c.getEnterpriseId()))
                .orElseThrow(()->denied("ENTERPRISE_BILLING_REVOKED","已离开此企业，不能使用企业积分"));
        entityManager.refresh(relation,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        var m=members.findById(relation.getMemberId()).orElseThrow(()->denied("ENTERPRISE_BILLING_REVOKED","成员关系已结束"));
        entityManager.refresh(m,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if(!"active".equals(e.getStatus())||!"active".equals(m.getStatus())||!enterpriseId.equals(m.getEnterpriseId())||!userId.equals(m.getUserId()))
            throw denied("ENTERPRISE_BILLING_REVOKED","成员或企业已停用，不能使用企业积分");
        return m;
    }
    public EnterpriseMember requireOrdinaryTarget(String actor,String enterpriseId,String targetId) {
        EnterpriseMember self=require(actor,enterpriseId,"member.manage");
        Enterprise e=enterprises.findById(enterpriseId).orElseThrow();
        EnterpriseMember target=members.findById(targetId).filter(m->enterpriseId.equals(m.getEnterpriseId()) && !"removed".equals(m.getStatus()))
                .orElseThrow(()->BusinessException.notFound("ENTERPRISE_MEMBER_NOT_FOUND","成员不存在"));
        if(actor.equals(target.getUserId()) || target.getUserId().equals(e.getOwnerUserId())
                || (!actor.equals(e.getOwnerUserId()) && !"member".equals(target.getRole())))
            throw denied("ENTERPRISE_PERMISSION_DENIED","不能操作自己或更高权限的成员");
        return target;
    }
    public List<String> permissions(Enterprise e,EnterpriseMember m) {
        var out=new ArrayList<>(List.of("enterprise.read"));
        if(!"active".equals(e.getStatus())||!"active".equals(m.getStatus()))return List.copyOf(out);
        boolean owner=e.getOwnerUserId().equals(m.getUserId());
        if(owner || "manager".equals(m.getRole())) out.addAll(List.of("member.invite","member.manage"));
        if(owner) out.addAll(List.of("member.role.manage","policy.manage","ownership.transfer"));
        if(owner || ("manager".equals(m.getRole()) && m.isPointsManage())) out.add("points.manage");
        if(owner || ("manager".equals(m.getRole()) && m.isBillingRead())) out.addAll(List.of("billing.read","usage.read"));
        if(owner || m.isRechargeRequest()) out.add("billing.request");
        return List.copyOf(out);
    }
    static BusinessException denied(String code,String message){return new BusinessException(HttpStatus.FORBIDDEN,code,message);}
}
