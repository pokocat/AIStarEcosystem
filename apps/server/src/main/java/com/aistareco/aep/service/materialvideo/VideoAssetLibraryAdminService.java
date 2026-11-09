package com.aistareco.aep.service.materialvideo;

import com.aistareco.common.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Map;

/** Provisioning uses the existing signed, audited model-management path. Credentials never appear in results. */
@Service
public class VideoAssetLibraryAdminService {
    private final VideoAssetLibraryRecordRepository repo;private final ArkAssetClient api;
    public VideoAssetLibraryAdminService(VideoAssetLibraryRecordRepository repo,ArkAssetClient api){this.repo=repo;this.api=api;}
    public record Configuration(String name,String projectName,String virtualGroupId,String accessKeyId,String secretAccessKey) {
        @Override public String toString(){return "Configuration["+name+"]";}
    }
    @Transactional
    public Map<String,String> save(String id,Configuration input) throws Exception {
        if(!id.matches("[a-z0-9-]{1,64}")||input.name()==null||input.name().length()>128
                ||input.projectName()==null||!input.projectName().matches("[A-Za-z0-9_-]{1,128}")
                ||input.virtualGroupId()==null||!input.virtualGroupId().matches("group-[a-zA-Z0-9-]+"))
            throw BusinessException.badRequest("VIDEO_ASSET_LIBRARY_INVALID","素材库配置无效。");
        var r=repo.findById(id).orElseGet(VideoAssetLibraryRecord::new);
        if(r.getAdapter()!=null&&!"ark".equals(r.getAdapter()))throw BusinessException.badRequest("VIDEO_ASSET_LIBRARY_INVALID","不能更改已有素材库的渠道。");
        if(r.getConfigJson()!=null){var old=new ObjectMapper().readTree(r.getConfigJson());
            if(!input.projectName().equals(old.path("projectName").asText()))throw BusinessException.badRequest("VIDEO_ASSET_LIBRARY_INVALID","更换项目需要创建新的素材库。");}
        r.setId(id);r.setName(input.name());r.setAdapter("ark");
        r.setConfigJson(new ObjectMapper().writeValueAsString(Map.of("projectName",input.projectName(),"virtualGroupId",input.virtualGroupId())));
        if(input.accessKeyId()!=null&&input.secretAccessKey()!=null&&!input.accessKeyId().isBlank()&&!input.secretAccessKey().isBlank())
            r.setCredentialEncrypted(AepCryptoUtil.encrypt(input.accessKeyId()+":"+input.secretAccessKey()));
        if(r.getCredentialEncrypted()==null)throw BusinessException.badRequest("VIDEO_ASSET_LIBRARY_INVALID","请配置官方素材库凭据。");
        // Validate the project and group before binding any model; this is a read-only provider operation.
        var group=api.call(r,"GetAssetGroup",Map.of("Id",input.virtualGroupId()));
        if(!input.virtualGroupId().equals(group.path("Id").asText())||!"AIGC".equals(group.path("GroupType").asText()))
            throw BusinessException.badRequest("VIDEO_ASSET_LIBRARY_INVALID","虚拟人像素材组与配置不一致。");
        if(r.getCreatedAt()==null)r.setCreatedAt(Instant.now());r.setUpdatedAt(Instant.now().minusSeconds(30));repo.save(r);
        return Map.of("id",id,"name",r.getName(),"projectName",input.projectName(),"virtualGroupId",input.virtualGroupId());
    }
}
