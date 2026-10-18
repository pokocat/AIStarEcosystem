package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import java.time.Instant;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;

/** One cover lifecycle for personal projects and published template catalogue metadata. */
@Service @Slf4j
public class CanvasCoverService {
    public record Cover(String coverUrl) {}
    private record Target(String id, String key, JsonNode doc, Consumer<String> write) {}
    private final IpProjectService projects;
    private final IpDemoTemplateRepository templates;
    private final FileStorageService storage;
    private final ObjectMapper mapper;
    private final EntityManager em;
    private final IpCatalogService catalog;
    private final PlatformConfigService configs;
    public CanvasCoverService(IpProjectService projects, IpDemoTemplateRepository templates,
            FileStorageService storage, ObjectMapper mapper, EntityManager em,
            IpCatalogService catalog, PlatformConfigService configs) {
        this.projects=projects; this.templates=templates; this.storage=storage; this.mapper=mapper; this.em=em;
        this.catalog=catalog; this.configs=configs;
    }

    @Transactional
    public Cover upload(String owner, String kind, String id, boolean superAdmin, MultipartFile file) {
        Target target=target(owner,kind,id,superAdmin);
        var image=projects.uploadImage(file,"ipstudio/cover",id);
        // Register rollback cleanup before mutating the entity. Covers never enter doc or a recipe version.
        cleanupOnCompletion(image.key(),target.key(),id);
        target.write().accept(image.key());
        return new Cover(image.url());
    }

    @Transactional
    public Cover select(String owner, String kind, String id, boolean superAdmin, String key) {
        Target target=target(owner,kind,id,superAdmin);
        if(key==null || key.isBlank() || !containsImage(target.doc(),key))
            throw BusinessException.badRequest("IP_COVER_INVALID","请选择这张画布中的图片作为封面");
        if("project".equals(kind)) projects.requireOwnedAssetKey(owner,key);
        target.write().accept(key);
        cleanupOnCompletion(null,target.key(),id);
        return new Cover(storage.signedUrl(key));
    }

    @Transactional
    public Cover reset(String owner, String kind, String id, boolean superAdmin) {
        Target target=target(owner,kind,id,superAdmin);
        target.write().accept(null);
        cleanupOnCompletion(null,target.key(),id);
        return new Cover(null); // The shared client derives the automatic image from the unchanged doc.
    }

    private Target target(String owner,String kind,String id,boolean superAdmin) {
        if("project".equals(kind)) {
            var row=projects.requiredForUpdate(owner,id);
            return new Target(id,row.getCoverKey(),projects.readDoc(row),key->{row.setCoverKey(key);row.setUpdatedAt(Instant.now());});
        }
        if(!"template".equals(kind)) throw BusinessException.badRequest("IP_COVER_TARGET_INVALID","不支持的封面类型");
        var row=templates.findById(id).orElse(null);
        if(row==null) {
            // Built-in workflows stay in classpath. Persist only their cover override;
            // never create a second template/document or freeze a future workflow update.
            if(!superAdmin) throw notFound();
            var builtin=catalog.template(id).orElseThrow(CanvasCoverService::notFound);
            configs.lockExisting(builtinConfigKey(id));
            return new Target(id,builtinCoverKey(configs,id),builtin.doc(),key->{
                var value=mapper.createObjectNode();
                if(key==null)value.putNull("storageKey");else value.put("storageKey",key);
                configs.upsert(builtinConfigKey(id),value,"Studio 内置官方模板封面",owner);
            });
        }
        boolean personal="personal".equals(row.getVisibility());
        if(personal ? !owner.equals(row.getCreatedBy()) : !superAdmin) throw notFound();
        em.lock(row,LockModeType.PESSIMISTIC_WRITE);
        JsonNode doc;
        try {doc=mapper.readTree(row.getDocJson());} catch(Exception e) {throw BusinessException.badRequest("IP_DOC_INVALID","画布内容暂不可用");}
        return new Target(id,row.getCoverKey(),doc,key->{row.setCoverKey(key);row.setUpdatedAt(Instant.now());});
    }

    public static boolean containsImage(JsonNode doc,String key) {
        for(JsonNode node:IpDocs.nodes(doc)) {
            if(!"image".equals(node.path("type").asText())) continue;
            JsonNode metadata=IpDocs.metadataOf(node);
            if(key.equals(IpDocs.text(metadata,"storageKey"))) return true;
            for(JsonNode image:metadata.path("images")) if(key.equals(IpDocs.text(image,"storageKey"))) return true;
        }
        return false;
    }
    public static String firstImageKey(JsonNode doc, java.util.function.Predicate<String> allowed) {
        for(JsonNode node:IpDocs.nodes(doc)) {
            if(!"image".equals(node.path("type").asText()))continue;
            JsonNode md=IpDocs.metadataOf(node);
            String primary=IpDocs.text(md,"primaryImageId");
            for(JsonNode image:md.path("images")) {
                String key=IpDocs.text(image,"storageKey");
                if(primary!=null && primary.equals(IpDocs.text(image,"id")) && key!=null && allowed.test(key))return key;
            }
            String key=IpDocs.text(md,"storageKey");
            if(key!=null && allowed.test(key))return key;
            for(JsonNode image:md.path("images")) {
                key=IpDocs.text(image,"storageKey");if(key!=null && allowed.test(key))return key;
            }
        }
        return null;
    }
    public static boolean isUploadedCover(String key,String id) {
        return key!=null && key.startsWith("ipstudio_cover/"+id.replaceAll("[^A-Za-z0-9_-]","_")+"/");
    }
    public static String builtinConfigKey(String id) {return "studio.builtin-cover."+id;}
    public static String builtinCoverKey(PlatformConfigService configs,String id) {
        return configs==null?null:configs.findByKey(builtinConfigKey(id))
                .map(c->IpDocs.text(c.value(),"storageKey")).orElse(null);
    }
    private static BusinessException notFound(){return BusinessException.notFound("IP_TEMPLATE_NOT_FOUND","模板不存在或无权修改封面");}
    private void cleanupOnCompletion(String uploaded,String previous,String id) {
        if(!TransactionSynchronizationManager.isSynchronizationActive())return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
            @Override public void afterCompletion(int status) {
                String remove=status==STATUS_COMMITTED && isUploadedCover(previous,id)?previous:status==STATUS_ROLLED_BACK?uploaded:null;
                if(remove!=null)try{storage.delete(remove);}catch(Exception e){log.warn("[canvas-cover] cleanup failed target={}",id,e);}
            }
        });
    }
}
