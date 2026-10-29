package com.aistareco.aep.enterprise.service;

import com.aistareco.aep.enterprise.dto.EnterpriseDtos.*;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import java.util.*;

/** Deliberately no outer transaction: each phone commits or rolls back independently. */
@Service
public class EnterpriseMemberBatchService {
    private final EnterpriseService service;
    private final EnterpriseAccessService access;
    public EnterpriseMemberBatchService(EnterpriseService service,EnterpriseAccessService access) {
        this.service=service;this.access=access;
    }
    public MemberBatchAddResult addMembers(String actor,String enterpriseId,MemberBatchAddRequest request) {
        access.require(actor,enterpriseId,"member.invite");
        if(request==null || request.phones()==null || request.phones().isEmpty() || request.phones().size()>100)
            throw BusinessException.badRequest("ENTERPRISE_INPUT_INVALID","每次请输入 1 至 100 个手机号");
        var phones=new LinkedHashSet<String>();
        for(String raw:request.phones()) {
            if(raw!=null && raw.length()>32)throw BusinessException.badRequest("ENTERPRISE_INPUT_INVALID","单个手机号输入过长");
            phones.add(raw==null?"":raw.replaceAll("\\s+","").replaceFirst("^\\+86",""));
        }
        var results=new ArrayList<MemberAddResult>();int succeeded=0;
        for(String phone:phones) {
            try {
                var member=service.addMember(actor,enterpriseId,new MemberAddRequest(phone));
                results.add(new MemberAddResult(phone,"success",member,null,null));succeeded++;
            } catch(BusinessException failure) {
                results.add(new MemberAddResult(phone,"failed",null,failure.getCode(),failure.getMessage()));
            }
        }
        return new MemberBatchAddResult(List.copyOf(results),succeeded,results.size()-succeeded);
    }
}
