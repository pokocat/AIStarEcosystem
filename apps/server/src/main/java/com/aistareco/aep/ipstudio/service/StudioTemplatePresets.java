package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.ipstudio.model.IpDemoTemplate;
import com.aistareco.aep.ipstudio.model.IpTemplateVersion;
import com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository;
import com.aistareco.aep.ipstudio.repository.IpTemplateVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;

/** Media-free official recipes. Seed missing catalog entries; never overwrite a release or re-enable it. */
@Service
public class StudioTemplatePresets {
    private final IpDemoTemplateRepository templates;
    private final IpTemplateVersionRepository versions;
    private final ObjectMapper mapper;
    public StudioTemplatePresets(IpDemoTemplateRepository templates,IpTemplateVersionRepository versions,ObjectMapper mapper) {
        this.templates=templates;this.versions=versions;this.mapper=mapper;
    }
    public record Preset(String id,String name,String summary,Recipe recipe) {}
    public static List<Preset> definitions() {
        var person=new Input("character","character","人物参考","character",true,null,null);
        var digital=new Recipe(List.of(person,new Input("brief","brief","视频要求","text",true,null,"向镜头自然打招呼，服饰与背景保持一致。")),List.of(
                new Step("frame","frame","数字人镜头图","image","以人物参考图保持同一人物身份、服饰和细节，生成一张适合竖屏短视频的独立镜头图。创作要求：{{brief}}",List.of("character"),"768x1365","custom",true),
                new Step("video","video","数字人视频片段","video","使用已采用的镜头图作为首帧，保持人物、服饰和环境。动作自然连贯。创作要求：{{brief}}",List.of("frame"),null,"video",true,5,"9:16",null)));
        var commerce=new Recipe(List.of(person,new Input("product","product","商品参考","image",true,null,null),new Input("brief","brief","商品卖点与视频要求","text",true,null,null)),List.of(
                new Step("frame","frame","商品展示画面","image","参考图1是人物，参考图2是商品。保持人物身份和商品外观，生成自然清晰的竖屏商品展示画面，不额外添加文字或标志。卖点与创作要求：{{brief}}",List.of("character","product"),"768x1365","custom",true),
                new Step("video","video","商品视频片段","video","以已采用的商品展示画面作为首帧，保持人物和商品，人物自然展示商品，镜头稳定。卖点与创作要求：{{brief}}",List.of("frame"),null,"video",true,5,"9:16",null)));
        return List.of(new Preset("IPD-studio-digital","数字人形象视频","人物参考 → 镜头图 → 视频。在同一画布继续配音、口型同步和成片。",digital),
                new Preset("IPD-studio-commerce","IP 商品视频","人物与商品参考 → 展示画面 → 带货视频片段。每步先确认结果和费用。",commerce));
    }
    static ObjectNode source(Preset preset,ObjectMapper mapper) {
        var doc=IpDocs.emptyDoc(mapper);var nodes=doc.withArray("nodes");
        int row=0;
        for(var input:preset.recipe().inputs()) {
            var n=nodes.addObject().put("id",input.nodeId()).put("type",List.of("image","character").contains(input.type())?"image":"text").put("title",input.label()).put("width",320).put("height",360);
            n.putObject("position").put("x",80).put("y",80+row++*420);n.putObject("metadata").put("status","idle");
        }
        int column=1;
        for(var step:preset.recipe().steps()) {
            var n=nodes.addObject().put("id",step.nodeId()).put("type",step.operation()).put("title",step.title()).put("width",320).put("height",440);
            n.putObject("position").put("x",80+column++*460).put("y",120);n.putObject("metadata").put("status","idle");
        }
        return doc;
    }
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seed() {
        for(var preset:definitions()) {
            if(templates.existsById(preset.id()))continue;
            var source=source(preset,mapper);var recipe=StudioTemplateService.validateRecipe(preset.recipe(),source);
            var doc=StudioTemplateService.cleanDoc(source,recipe);String versionId=preset.id().replace("IPD-","IPV-")+"-v1";
            var now=Instant.now();
            try {
                versions.save(IpTemplateVersion.builder().id(versionId).templateId(preset.id()).version(1).name(preset.name()).summary(preset.summary()).recipeJson(mapper.writeValueAsString(recipe)).docJson(doc.toString()).createdAt(now).build());
                templates.save(IpDemoTemplate.builder().id(preset.id()).name(preset.name()).summary(preset.summary()).kind("template").visibility("official").currentVersionId(versionId).docJson(doc.toString()).createdBy("platform").createdAt(now).updatedAt(now).sortOrder(-20).build());
            } catch(com.fasterxml.jackson.core.JsonProcessingException e) {throw new IllegalStateException(e);}
        }
    }
}
