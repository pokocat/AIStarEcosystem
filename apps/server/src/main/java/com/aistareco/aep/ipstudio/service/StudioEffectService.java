package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioEffectDtos.*;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.storage.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/** Library and personal activity only. Applying returns an immutable instruction; never creates a job or touches credits. */
@Service
public class StudioEffectService {
    private final IpVideoEffectRepository effects;
    private final IpVideoEffectActivityRepository activity;
    private final IpProjectService projects;
    private final AiModelInvocationService models;
    private final FileStorageService storage;
    private final EntityManager em;
    private final ObjectMapper mapper;
    public StudioEffectService(IpVideoEffectRepository effects,IpVideoEffectActivityRepository activity,IpProjectService projects,
            AiModelInvocationService models,FileStorageService storage,EntityManager em,ObjectMapper mapper) {
        this.effects=effects;this.activity=activity;this.projects=projects;this.models=models;this.storage=storage;this.em=em;this.mapper=mapper;
    }
    @Transactional(readOnly=true) public List<Effect> list(String owner) {
        var states=new HashMap<String,IpVideoEffectActivity>();activity.findByOwnerUserId(owner).forEach(a->states.put(a.getEffectId(),a));
        return effects.accessible(owner).stream().map(e->view(e,states.get(e.getId()))).toList();
    }
    @Transactional public Effect publish(String owner,Publish req) {
        if(req==null)throw invalid("请填写特效描述");
        text(req.name(),128,"名称");text(req.prompt(),8000,"效果描述");
        if(req.summary()!=null && req.summary().length()>1024)throw invalid("简介最多 1024 字");
        if(!Set.of("personal","official").contains(Objects.toString(req.visibility(),"")))throw invalid("请选择可见范围");
        var tags=strings(req.tags(),8,32,"标签");var allowed=strings(req.models(),32,128,"模型");
        for(String model:allowed)requireModel(model);
        String key=req.previewKey();
        if(key!=null && !key.isBlank()) {
            key=projects.requireOwnedAssetKey(owner,key);
            try(var in=java.nio.file.Files.newInputStream(storage.openForRead(key))) {
                if(MediaBytes.sniff("image",in.readNBytes(64))==null)throw invalid("预览需要一张可读取的图片");
            } catch(BusinessException e){throw e;}catch(Exception e){throw invalid("预览图片已不可用，请重新选择");}
        } else key=null;
        var user=em.find(AepUser.class,owner);
        String author=user==null || user.getDisplayName()==null || user.getDisplayName().isBlank()?"创作者":user.getDisplayName();
        var row=IpVideoEffect.builder().id(id("IPE-")).ownerUserId(owner).name(req.name().trim()).summary(Objects.toString(req.summary(),"").trim())
                .prompt(req.prompt().trim()).author(author.substring(0,Math.min(author.length(),128))).visibility(req.visibility())
                .tagsJson(write(tags)).modelsJson(write(allowed)).previewKey(key).createdAt(Instant.now()).build();
        effects.save(row);return view(row,null);
    }
    @Transactional public Effect favorite(String owner,String effectId,boolean favorite) {
        var effect=required(owner,effectId);lockOwner(owner);
        var state=state(owner,effectId);state.setFavorite(favorite);activity.save(state);return view(effect,state);
    }
    @Transactional public Effect apply(String owner,String effectId,String model) {
        var effect=required(owner,effectId);requireModel(model);
        var allowed=read(effect.getModelsJson());
        if(!allowed.isEmpty() && !allowed.contains(model))throw BusinessException.badRequest("STUDIO_EFFECT_MODEL_UNSUPPORTED","此特效不适用于当前模型，请选择适用模型或其他特效");
        lockOwner(owner);var state=state(owner,effectId);state.setLastUsedAt(Instant.now());activity.save(state);return view(effect,state);
    }
    private void lockOwner(String owner) {
        // Serialize first-row creation and read-modify-write across tabs; avoids losing favorites when applying concurrently.
        if(em.find(AepUser.class,owner,LockModeType.PESSIMISTIC_WRITE)==null)throw BusinessException.notFound("STUDIO_EFFECT_ACCOUNT_NOT_FOUND","账号已不可用，请重新登录");
    }
    private IpVideoEffectActivity state(String owner,String effectId) {
        return activity.findByOwnerUserIdAndEffectId(owner,effectId).orElseGet(()->IpVideoEffectActivity.builder().id(id("IPEA-")).ownerUserId(owner).effectId(effectId).build());
    }
    private IpVideoEffect required(String owner,String id) {
        return effects.findById(id).filter(e->"official".equals(e.getVisibility()) || owner.equals(e.getOwnerUserId()))
                .orElseThrow(()->BusinessException.notFound("STUDIO_EFFECT_NOT_FOUND","特效不存在或不属于你"));
    }
    private void requireModel(String model) {
        if(model==null || model.isBlank() || models.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION,model).isEmpty())
            throw BusinessException.badRequest("STUDIO_EFFECT_MODEL_UNAVAILABLE","请选择已配置的视频模型");
    }
    private Effect view(IpVideoEffect e,IpVideoEffectActivity a) {
        return new Effect(e.getId(),e.getName(),e.getSummary(),e.getPrompt(),e.getAuthor(),e.getVisibility(),read(e.getTagsJson()),read(e.getModelsJson()),e.getPreviewKey(),
                e.getPreviewKey()==null?null:storage.signedUrl(e.getPreviewKey()),a!=null && a.isFavorite(),a==null?null:a.getLastUsedAt(),e.getCreatedAt());
    }
    private List<String> strings(List<String> values,int max,int length,String label) {
        if(values==null || values.size()>max)throw invalid(label+"最多 "+max+" 项");
        for(String value:values)text(value,length,label);
        return values.stream().map(String::trim).distinct().toList();
    }
    private void text(String value,int max,String label){if(value==null || value.isBlank() || value.length()>max)throw invalid(label+"不能为空且最多 "+max+" 字");}
    private String write(List<String> value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    private List<String> read(String value){try{return mapper.readValue(value,new TypeReference<List<String>>(){});}catch(Exception e){throw new IllegalStateException("Invalid effect catalogue",e);}}
    private static String id(String prefix){return prefix+UUID.randomUUID().toString().replace("-","").substring(0,20);}
    private static BusinessException invalid(String message){return BusinessException.badRequest("STUDIO_EFFECT_INPUT_INVALID",message);}
}
