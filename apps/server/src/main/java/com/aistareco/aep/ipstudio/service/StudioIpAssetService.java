package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapAvatarVersionRepository;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.dap.model.DapLook;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.IpAsset;
import com.aistareco.aep.service.storage.FileStorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.aistareco.common.BusinessException;
import java.util.*;

/** Asset records prove ownership; client canvas metadata never grants access. */
@Service
public class StudioIpAssetService {
    private static final Set<String> LOOK_ROLES=Set.of("sheet","portrait","three-view","front","side","back","expression","detail","look");
    private final DapAvatarRepository avatars;
    private final DapAvatarVersionRepository versions;
    private final FileStorageService storage;
    private final DapLookRepository looks;
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository officialDemos;
    private static final com.fasterxml.jackson.databind.ObjectMapper JSON = new com.fasterxml.jackson.databind.ObjectMapper();
    public StudioIpAssetService(DapAvatarRepository avatars,DapAvatarVersionRepository versions,FileStorageService storage,DapLookRepository looks) {
        this.avatars=avatars;this.versions=versions;this.storage=storage;this.looks=looks;
    }
    public List<IpAsset> list(String userId) {
        List<IpAsset> result=new ArrayList<>();
        for(DapAvatar avatar:avatars.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId)) {
            // Older canvas publications have a character but no IP container yet. Let users attach it explicitly.
            if(avatar.getImageKey()==null) continue;
            result.add(asset(avatar,avatar.getVersions(),avatar.getImageKey(),true));
            for(var version:versions.findByAvatarIdOrderByVDesc(avatar.getId())) {
                if(version.getV()==avatar.getVersions() || version.getImageKey()==null) continue;
                result.add(asset(avatar,version.getV(),version.getImageKey(),false));
            }
            for(var look:looks.findByAvatarIdOrderByCreatedAtDesc(avatar.getId())) {
                if(!userId.equals(look.getOwnerUserId()) || !"done".equals(look.getStatus()) || look.getImageKey()==null || "final".equals(look.getSource()) && Objects.equals(look.getImageKey(),avatar.getImageKey())) continue;
                result.add(lookAsset(avatar,look));
            }
        }
        result.addAll(officialAssets());
        return result;
    }
    /** Only published platform snapshots can enter Official IP. Never expose an author's source keys or avatar ids. */
    public List<IpAsset> officialAssets() {
        if(officialDemos==null)return List.of();
        var result=new ArrayList<IpAsset>();
        for(var demo:officialDemos.findByEnabledTrueOrderBySortOrderAscCreatedAtAsc()) {
            if(!"official".equals(demo.getVisibility()))continue;
            try {
                String probe=storage.allocateKey(IpDemoTemplateService.CATEGORY_DEMO,demo.getId(),"probe.png");
                String prefix=probe.substring(0,probe.lastIndexOf('/')+1);
                var nodes=JSON.readTree(demo.getDocJson()).path("nodes");
                for(var node:nodes) {
                    if(!"image".equals(node.path("type").asText()))continue;
                    var metadata=node.path("metadata");var studio=metadata.path("studio");
                    String role=studio.path("libraryAssetRole").asText("main");
                    if(!"ip".equals(studio.path("kind").asText())&&!studio.has("libraryAssetRole"))continue;
                    String key=metadata.path("storageKey").asText();
                    if(key.isBlank()||!key.startsWith(prefix))continue;
                    String nodeId=node.path("id").asText();
                    String name=node.path("title").asText(demo.getName());
                    String group=studio.path("libraryCharacterId").asText(studio.path("adoption").path("avatarId").asText(nodeId));
                    String characterName=studio.path("libraryCharacterName").asText(name);
                    String id="official:"+demo.getId()+":"+UUID.nameUUIDFromBytes(group.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    String assetRole=LOOK_ROLES.contains(role)?role:"main";
                    result.add(new IpAsset(null,id,1,key,name,storage.signedUrl(key),"main".equals(assetRole),null,
                            characterName,"ai",assetRole,metadata.path("prompt").asText(demo.getSummary()),Map.of(),"official"));
                }
            } catch(java.io.IOException ignored) { /* Malformed legacy snapshots do not break My IP. */ }
        }
        return result;
    }
    private IpAsset asset(DapAvatar avatar,int version,String key,boolean current) {
        return new IpAsset(avatar.getIpId(),avatar.getId(),version,key,avatar.getName(),storage.signedUrl(key),current,null,
                avatar.getName(),avatar.getPath(),current?"main":"history",avatar.getDescPrompt(),attributes(avatar));
    }
    private IpAsset lookAsset(DapAvatar avatar,DapLook look) {
        return new IpAsset(avatar.getIpId(),avatar.getId(),avatar.getVersions(),look.getImageKey(),look.getLabel(),storage.signedUrl(look.getImageKey()),false,look.getId(),
                avatar.getName(),avatar.getPath(),LOOK_ROLES.contains(Objects.toString(look.getAssetRole(),""))?look.getAssetRole():"look",avatar.getDescPrompt(),attributes(avatar));
    }
    private Map<String,String> attributes(DapAvatar avatar) {
        var result=new LinkedHashMap<String,String>();
        if(avatar.getDef()!=null)avatar.getDef().forEach((k,v)->{if(result.size()<24 && k!=null && k.length()<=32 && v instanceof String text && !text.isBlank() && !Set.of("—","-","未填写").contains(text))result.put(k,text.substring(0,Math.min(text.length(),300)));});
        return result;
    }
    public static void requireLookRole(String role) {
        if(role!=null && !LOOK_ROLES.contains(role))throw BusinessException.badRequest("STUDIO_ASSET_ROLE_INVALID","请选择设定图、特写、视角、表情、细节或造型");
    }
    public String saveLook(DapAvatar avatar,String label,String key,String prompt) {
        return saveLook(avatar,label,key,prompt,null);
    }
    public String saveLook(DapAvatar avatar,String label,String key,String prompt,String role) {
        requireLookRole(role);
        String id="DL-"+UUID.randomUUID().toString().replace("-","").substring(0,20);
        looks.save(DapLook.builder().id(id).avatarId(avatar.getId()).ownerUserId(avatar.getOwnerUserId()).label(label)
                .source("design").assetRole(role).prompt(prompt).status("done").imageKey(key).createdAt(java.time.Instant.now()).build());
        return id;
    }
    @Transactional public IpAsset classify(String owner,String avatarId,String lookId,String role) {
        if(role==null)throw BusinessException.badRequest("STUDIO_ASSET_ROLE_INVALID","请选择素材类别");requireLookRole(role);
        var avatar=avatars.lockOwned(avatarId,owner).orElseThrow(()->BusinessException.badRequest("STUDIO_AVATAR_NOT_FOUND","人物不存在或不属于你"));
        var look=looks.findById(lookId).filter(l->owner.equals(l.getOwnerUserId()) && avatarId.equals(l.getAvatarId()) && "done".equals(l.getStatus()) && l.getImageKey()!=null)
                .orElseThrow(()->BusinessException.badRequest("STUDIO_LOOK_NOT_FOUND","素材不存在或不属于此人物"));
        look.setAssetRole(role);looks.save(look);return lookAsset(avatar,look);
    }
    public boolean matchesLook(DapAvatar avatar,String lookId,String key) {
        return looks.findById(lookId).filter(l->avatar.getId().equals(l.getAvatarId()) && avatar.getOwnerUserId().equals(l.getOwnerUserId()) && "done".equals(l.getStatus()) && Objects.equals(key,l.getImageKey())).isPresent();
    }
    public boolean matchesVersion(DapAvatar avatar,String key,Integer version) {
        if(version==null || version==avatar.getVersions())
            return Objects.equals(key,avatar.getImageKey()) || avatar.getVariantKeys()!=null && avatar.getVariantKeys().contains(key);
        // An explicit old snapshot remains usable after the IP's main image is updated.
        return versions.findByAvatarIdAndV(avatar.getId(),version).filter(v->Objects.equals(key,v.getImageKey())).isPresent();
    }
    public boolean owns(String userId,String key) {
        for(DapAvatar avatar:avatars.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId)) {
            if(matchesVersion(avatar,key,null)) return true;
            if(versions.findByAvatarIdOrderByVDesc(avatar.getId()).stream().anyMatch(v->Objects.equals(key,v.getImageKey()))) return true;
            if(looks.findByAvatarIdOrderByCreatedAtDesc(avatar.getId()).stream().anyMatch(l->userId.equals(l.getOwnerUserId()) && "done".equals(l.getStatus()) && Objects.equals(key,l.getImageKey()))) return true;
        }
        return false;
    }
}
