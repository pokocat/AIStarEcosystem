package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.IpDemoTemplate;
import com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;

/** Ordinary, media-free template canvases. No execution plan, generated result or new project domain. */
@Service
public class StudioScenePresets {
    private final IpDemoTemplateRepository templates;
    private final ObjectMapper mapper;
    public StudioScenePresets(IpDemoTemplateRepository templates,ObjectMapper mapper) {this.templates=templates;this.mapper=mapper;}
    record Scene(String id,String name,String summary) {}
    static List<Scene> definitions() {
        return List.of(new Scene("IPD-scene-commerce","剧情带货","让商品成为故事的一部分。"),
                new Scene("IPD-scene-recreation","爆款复刻","借鉴出彩的结构，创作自己的表达。"));
    }
    static ObjectNode document(ObjectMapper mapper,boolean commerce) {
        var doc=IpDocs.emptyDoc(mapper);
        node(doc,"reference",commerce?"image":"video",commerce?"商品参考":"参考视频",80,80,commerce?"上传商品图片。商品库选品【待建设】。":"上传参考视频，可使用画布已有的解析功能。",null);
        node(doc,"facts","text",commerce?"商品信息":"拆解要点",80,520,commerce?"填写你核对过的商品信息，不确定的内容留空。":"记录值得借鉴的节奏、结构和镜头安排。",commerce?"商品名称：\n已核对的信息：\n需要避免的表达：":"故事结构：\n镜头节奏：\n值得借鉴的表达：");
        node(doc,"brief","text",commerce?"植入要求":"改编要求",520,520,commerce?"说明要植入的场景与方式，保留哪些原有情节。":"确定自己的主题、角色，以及希望保留或改变的内容。",commerce?"保留人物与故事走向，将商品自然融入指定场景。":"主题：\n人物：\n保留的结构：\n新的表达：");
        node(doc,"script","text","剧本创作",520,80,commerce?"参考商品信息与植入要求创作或改写剧本。商品与剧本的专用融合操作【待建设】，可先使用已有剧本与文本创作工具。":"依据拆解要点和改编要求，创作新的故事。保留自己的主题与表达。",null);
        ((ObjectNode)IpDocs.node(doc,"script")).withObject("/metadata").putObject("studio").put("kind","script");
        for(var from:List.of("reference","facts","brief")) doc.withArray("connections").addObject().put("id","edge-"+from).put("fromNodeId",from).put("toNodeId","script");
        return doc;
    }
    private static void node(ObjectNode doc,String id,String type,String title,int x,int y,String prompt,String content) {
        var n=doc.withArray("nodes").addObject().put("id",id).put("type",type).put("title",title).put("width",360).put("height",340);
        n.putObject("position").put("x",x).put("y",y);
        var md=n.putObject("metadata").put("status","idle").put("prompt",prompt);
        if(content!=null)md.put("content",content);
    }
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seed() {
        for(var scene:definitions()) {
            if(templates.existsById(scene.id()))continue;
            var now=Instant.now();
            templates.save(IpDemoTemplate.builder().id(scene.id()).name(scene.name()).summary(scene.summary()).kind("template").visibility("official")
                    .docJson(document(mapper,scene.id().endsWith("commerce")).toString()).createdBy("platform").createdAt(now).updatedAt(now).sortOrder(-25).build());
        }
    }
}
