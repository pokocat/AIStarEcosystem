package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Reference;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpProjectDto;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.*;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioTemplateServiceTest {
    final ObjectMapper om=new ObjectMapper();
    final IpDemoTemplateRepository templates=mock(IpDemoTemplateRepository.class);
    final IpTemplateVersionRepository versions=mock(IpTemplateVersionRepository.class);
    final IpProjectService projects=mock(IpProjectService.class);final IpRunService images=mock(IpRunService.class);
    final AiModelInvocationService models=mock(AiModelInvocationService.class);final DapAvatarRepository avatars=mock(DapAvatarRepository.class);
    final StudioIpAssetService assets=mock(StudioIpAssetService.class);final FileStorageService storage=mock(FileStorageService.class);
    final Map<String,IpDemoTemplate> catalog=new LinkedHashMap<>();final Map<String,IpTemplateVersion> releases=new LinkedHashMap<>();final Map<String,IpProject> instances=new LinkedHashMap<>();
    StudioTemplateService service;ObjectNode doc;Recipe recipe;IpProject author;
    @TempDir Path dir;
    final StudioTemplateVideoService videos=mock(StudioTemplateVideoService.class);
    @BeforeEach void setup() throws Exception {
        service=new StudioTemplateService(templates,versions,projects,images,models,avatars,assets,storage,mock(EntityManager.class),om,videos,new IpDemoTemplateService(templates,projects,storage,om));
        when(projects.resignDocAssetUrls(any(),anyString())).thenAnswer(i->i.getArgument(0));
        doc=(ObjectNode)om.readTree("{\"nodes\":[{\"id\":\"a\",\"type\":\"image\",\"title\":\"Private source\",\"metadata\":{\"storageKey\":\"author/private.jpg\",\"content\":\"https://secret-url\",\"studio\":{\"adoption\":{\"avatarId\":\"author-person\"}}}},{\"id\":\"b\",\"type\":\"image\",\"title\":\"main\",\"metadata\":{\"runId\":\"author-run\",\"videoTaskId\":\"task\",\"images\":[{\"storageKey\":\"private-history\"}],\"apiKey\":\"secret-key\"}},{\"id\":\"c\",\"type\":\"image\",\"title\":\"side\"},{\"id\":\"chat\",\"type\":\"text\",\"metadata\":{\"content\":\"private conversation\"}}],\"connections\":[{\"fromNodeId\":\"a\",\"toNodeId\":\"b\"},{\"fromNodeId\":\"b\",\"toNodeId\":\"c\"}]}");
        recipe=new Recipe(List.of(new Input("character","a","人物","character",true,null,null)),List.of(
            new Step("main","b","主形象","image","主形象指令",List.of("character"),"768x1024","main",true),
            new Step("side","c","侧视图","image","保持主形象，侧面",List.of("main"),"768x1024","side",false)));
        author=IpProject.builder().id("source").ownerUserId("owner").docJson(doc.toString()).build();
        when(projects.requiredForUpdate("owner","source")).thenReturn(author);when(projects.readDoc(author)).thenAnswer(i->om.readTree(author.getDocJson()));
        when(templates.findById(anyString())).thenAnswer(i->Optional.ofNullable(catalog.get(i.getArgument(0))));
        when(templates.save(any())).thenAnswer(i->{IpDemoTemplate t=i.getArgument(0);catalog.put(t.getId(),t);return t;});
        when(versions.save(any())).thenAnswer(i->{IpTemplateVersion v=i.getArgument(0);releases.put(v.getId(),v);return v;});
        when(versions.findById(anyString())).thenAnswer(i->Optional.ofNullable(releases.get(i.getArgument(0))));
        when(versions.findByTemplateIdOrderByVersionDesc(anyString())).thenAnswer(i->releases.values().stream().filter(v->v.getTemplateId().equals(i.getArgument(0))).toList());
        var endpoint=AiModelEndpoint.builder().id("live-image").enabled(true).build();
        when(models.resolveEndpoint(eq(AiModelPurpose.DAP_IMAGE),any(),eq("studio"))).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(images.compileExplicit(eq("owner"),any())).thenReturn(new IpRunService.Compiled("generate",8,1,"image",om.createObjectNode(),false,true,"template"));
        when(projects.requireOwnedAssetKey(eq("owner"),anyString())).thenAnswer(i->{String key=i.getArgument(1);if(!key.startsWith("own/"))throw BusinessException.badRequest("IP_ASSET_KEY_INVALID","foreign");return key;});
        Path image=dir.resolve("image.png");javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",image.toFile());
        when(storage.openForRead(anyString())).thenReturn(image);when(storage.signedUrl(anyString())).thenReturn("temporary-signed-url");
        when(projects.create(eq("owner"),any())).thenAnswer(i->{String id="project"+instances.size();var p=IpProject.builder().id(id).ownerUserId("owner").name("mine").build();instances.put(id,p);return dto(p);});
        when(projects.requiredForUpdate(eq("owner"),argThat(id->id!=null&&id.startsWith("project")))).thenAnswer(i->instances.get(i.getArgument(1)));
        when(projects.required(eq("owner"),anyString())).thenAnswer(i->instances.get(i.getArgument(1)));
        when(projects.detail(eq("owner"),anyString())).thenAnswer(i->dto(instances.get(i.getArgument(1))));
    }
    IpProjectDto dto(IpProject p) throws Exception {return new IpProjectDto(p.getId(),p.getName(),p.getTemplateId(),"draft",null,null,null,null,null,p.getDocJson()==null?IpDocs.emptyDoc(om):om.readTree(p.getDocJson()),Map.of(),Map.of(),p.getTemplateVersionId());}
    Version publish(String id) {return service.publish("owner","source",new PublishRequest(id,"人物包","描述","personal",recipe));}
    void fullCanvasSource() throws Exception {
        doc=(ObjectNode)om.readTree("{\"nodes\":[{\"id\":\"text\",\"type\":\"text\",\"title\":\"描述\",\"position\":{\"x\":12,\"y\":34},\"metadata\":{\"content\":\"完整角色正文\",\"apiKey\":\"private-key\"}},{\"id\":\"image\",\"type\":\"image\",\"metadata\":{\"storageKey\":\"own/image.png\",\"content\":\"signed-source\",\"prompt\":\"角色图指令\",\"images\":[{\"id\":\"old\",\"storageKey\":\"own/old.png\",\"content\":\"signed-history\",\"runId\":\"private-run\"}]}},{\"id\":\"video\",\"type\":\"video\",\"metadata\":{\"storageKey\":\"own/video.mp4\",\"content\":\"signed-video\",\"videoTaskId\":\"private-task\"}},{\"id\":\"note\",\"type\":\"text\",\"metadata\":{\"content\":\"说明文字也保留\"}},{\"id\":\"chat\",\"type\":\"text\",\"metadata\":{\"studio\":{\"kind\":\"assistant\"}}}],\"connections\":[{\"id\":\"edge\",\"fromNodeId\":\"text\",\"toNodeId\":\"image\"},{\"fromNodeId\":\"image\",\"toNodeId\":\"video\"},{\"fromNodeId\":\"chat\",\"toNodeId\":\"text\"}],\"assistantConversations\":[{\"private\":true}],\"viewport\":{\"x\":1,\"y\":2,\"k\":0.8}}");
        author.setDocJson(doc.toString());
        when(storage.store(any(byte[].class),anyString(),anyString(),anyString(),anyString())).thenAnswer(i->new FileStorageService.StoredFile(i.<String>getArgument(1).replace('/','_')+"/"+i.getArgument(2)+"/"+UUID.randomUUID()+"."+i.getArgument(3),null,null,null,10,"image/png"));
    }
    @Test void fullCanvasPublicationPreservesAllAuthoredNodesTextMediaAndEdgesWithoutARecipe() throws Exception {
        fullCanvasSource();((com.fasterxml.jackson.databind.node.ArrayNode)IpDocs.node(doc,"image").path("metadata").path("images")).addObject().put("id","failed").put("status","error");
        var v=service.publish("owner","source",new PublishRequest(null,"完整画布","","official",null));
        assertEquals(4,v.doc().path("nodes").size());assertEquals(2,v.doc().path("connections").size());assertEquals("完整角色正文",IpDocs.node(v.doc(),"text").path("metadata").path("content").asText());
        assertEquals(34,IpDocs.node(v.doc(),"text").path("position").path("y").asInt());assertEquals(0.8,v.doc().path("viewport").path("k").asDouble());
        assertTrue(IpDocs.node(v.doc(),"image").path("metadata").path("storageKey").asText().startsWith("ipstudio_demo/"+v.id()+"/"));
        assertTrue(IpDocs.node(v.doc(),"video").path("metadata").path("storageKey").asText().endsWith(".mp4"));
        String persisted=releases.get(v.id()).getDocJson();for(String privateValue:List.of("own/","signed-","private-key","private-run","private-task","assistantConversations"))assertFalse(persisted.contains(privateValue),privateValue);
        assertEquals(1,IpDocs.node(v.doc(),"image").path("metadata").path("images").size());assertFalse(v.doc().toString().contains("failed"));
        assertTrue(v.recipe().steps().isEmpty());assertTrue(v.recipe().inputs().isEmpty());verifyNoInteractions(images,models,videos);
        assertEquals(5,doc.path("nodes").size());assertTrue(doc.has("assistantConversations"));
    }
    @Test void fullCanvasPublicationAndCopiesRetainGroupNotesAndRemapMembership() throws Exception {
        fullCanvasSource();
        doc.withArray("nodes").addObject().put("id","flow-group").put("type","group").put("title","换人生成")
            .putObject("metadata").put("groupDescription","替换人物图\n再生成视频");
        ((ObjectNode)IpDocs.node(doc,"image").path("metadata")).put("groupId","flow-group");
        author.setDocJson(doc.toString());
        var version=service.publish("owner","source",new PublishRequest(null,"分组画布","","official",null));
        var persisted=om.readTree(releases.get(version.id()).getDocJson());
        assertEquals("替换人物图\n再生成视频",IpDocs.node(persisted,"flow-group").path("metadata").path("groupDescription").asText());
        assertEquals("flow-group",IpDocs.node(persisted,"image").path("metadata").path("groupId").asText());
        var copy=StudioTemplateCanvasCopy.copy(om,persisted,version.recipe());
        var copiedGroup=copy.path("nodes").get(copy.path("nodes").size()-1);
        assertNotEquals("flow-group",copiedGroup.path("id").asText());
        assertEquals(copiedGroup.path("id").asText(),copy.path("nodes").get(1).path("metadata").path("groupId").asText());
        assertEquals("替换人物图\n再生成视频",copiedGroup.path("metadata").path("groupDescription").asText());
        assertEquals("flow-group",IpDocs.node(doc,"image").path("metadata").path("groupId").asText());
        verifyNoInteractions(images,models,videos);
    }
    @Test void fullCanvasUpdatesKeepPriorMediaAndPersonalCopiesRemainOwnerScoped() throws Exception {
        fullCanvasSource();var first=service.publish("owner","source",new PublishRequest(null,"完整画布","","personal",null));String prior=releases.get(first.id()).getDocJson();
        var next=service.publish("owner","source",new PublishRequest(first.templateId(),"完整画布","","personal",null));
        assertEquals(2,next.version());assertEquals(prior,releases.get(first.id()).getDocJson());
        String key=IpDocs.node(next.doc(),"image").path("metadata").path("storageKey").asText();assertTrue(key.startsWith("ipstudio_source/owner/"));
        assertNotEquals(key,IpDocs.node(first.doc(),"image").path("metadata").path("storageKey").asText());
        assertThrows(BusinessException.class,()->service.read("other",next.id()));verify(storage,never()).delete(anyString());
    }
    @Test void failedFullCanvasMediaCopyDoesNotPublishAPartialVersionAndCleansItsOwnCopies() throws Exception {
        fullCanvasSource();when(storage.openForRead("own/video.mp4")).thenThrow(new IllegalStateException("media unavailable"));
        var error=assertThrows(BusinessException.class,()->service.publish("owner","source",new PublishRequest(null,"完整画布","","official",null)));
        assertEquals("STUDIO_TEMPLATE_ASSET_COPY_FAILED",error.getCode());verify(versions,never()).save(any());verify(templates,never()).save(any());
        verify(storage,atLeastOnce()).delete(startsWith("ipstudio_demo/"));assertEquals("own/video.mp4",IpDocs.node(doc,"video").path("metadata").path("storageKey").asText());
    }
    @Test void foreignCanvasMediaFailsBeforeAnyFileCopy() throws Exception {
        fullCanvasSource();((ObjectNode)IpDocs.node(doc,"video").path("metadata")).put("storageKey","foreign/video.mp4");author.setDocJson(doc.toString());
        assertEquals("IP_ASSET_KEY_INVALID",assertThrows(BusinessException.class,()->service.publish("owner","source",new PublishRequest(null,"完整画布","","official",null))).getCode());
        verify(storage,never()).store(any(byte[].class),anyString(),anyString(),anyString(),anyString());verify(versions,never()).save(any());
    }
    UseRequest use(String id,String key) {return new UseRequest("mine",id,Map.of("character",new Value(null,new Reference(null,null,null,key,"character",null))),"live-image");}

    @Test void sanitizedReleaseCannotCarryMediaIdentityRunsOrChats() {
        var version=publish(null);assertEquals(1,version.version());String published=om.valueToTree(version).toString();
        for(String secret:List.of("author/private","secret-url","author-person","author-run","private-history","secret-key","private conversation"))assertFalse(published.contains(secret),secret);
        assertEquals(3,version.doc().path("nodes").size());assertEquals(2,version.doc().path("connections").size());assertEquals(4,doc.path("nodes").size());
    }
    @Test void quoteIsNativePricedFreeAndHasAnAdoptionDependency() {
        var v=publish(null);var plan=service.preview("owner",use(v.id(),"own/one.png"));
        assertEquals(16,plan.totalCost());assertEquals(2,plan.imageCount());assertEquals("live-image",plan.model());assertEquals("ready",plan.steps().get(0).status());assertEquals("waiting_adoption",plan.steps().get(1).status());
        verify(images,times(2)).preflight(any());verify(images,never()).generate(any(),any(),any());verify(projects,never()).create(any(),any());
    }
    @Test void oneShotCharacterSheetQuotesOneImageAndDoesNotInventEightJobs() {
        recipe=new Recipe(recipe.inputs(),List.of(new Step("sheet","b","人物设定图","image","One character sheet with front, side, back, expressions and details",List.of("character"),"1365x768","sheet",true)));
        var version=publish(null);var plan=service.preview("owner",use(version.id(),"own/one.png"));assertEquals(1,plan.imageCount());assertEquals(8,plan.totalCost());assertEquals("sheet",plan.steps().get(0).outputRole());
        var instance=service.instantiate("owner",use(version.id(),"own/one.png"));assertEquals(2,instance.project().doc().path("nodes").size());assertEquals(1,instance.plan().steps().size());verify(images,never()).generate(any(),any(),any());
    }
    @Test void twoDifferentInputsHaveIndependentNodesAndKeys() {
        var v=publish(null);var one=service.instantiate("owner",use(v.id(),"own/one.png"));var two=service.instantiate("owner",use(v.id(),"own/two.png"));
        assertNotEquals(one.project().id(),two.project().id());assertEquals(v.id(),one.project().templateVersionId());
        Set<String> ids=new HashSet<>();one.project().doc().path("nodes").forEach(n->ids.add(n.path("id").asText()));
        for(var n:two.project().doc().path("nodes"))assertFalse(ids.contains(n.path("id").asText()));
        assertTrue(one.project().doc().toString().contains("own/one.png"));assertFalse(one.project().doc().toString().contains("own/two.png"));assertFalse(two.project().doc().toString().contains("own/one.png"));
        assertFalse(one.project().doc().toString().contains("author/private"));verify(images,never()).generate(any(),any(),any());
    }
    @Test void newReleaseAndDownlistingCannotChangeExistingInstance() {
        var v1=publish(null);var old=service.instantiate("owner",use(v1.id(),"own/one.png"));
        var v2=publish(v1.templateId());assertEquals(2,v2.version());assertNotEquals(v1.id(),v2.id());assertEquals(v1,service.read("owner",v1.id()));
        assertEquals("STUDIO_TEMPLATE_VERSION_CHANGED",assertThrows(BusinessException.class,()->service.preview("owner",use(v1.id(),"own/one.png"))).getCode());
        var newer=service.instantiate("owner",use(v2.id(),"own/two.png"));assertEquals(v2.id(),newer.project().templateVersionId());
        service.availability("owner",v1.templateId(),false,false);
        assertEquals("STUDIO_TEMPLATE_NOT_FOUND",assertThrows(BusinessException.class,()->service.instantiate("owner",use(v2.id(),"own/two.png"))).getCode());
        assertEquals(v1.id(),service.instance("owner",old.project().id()).source().id());assertEquals(old.plan(),service.instance("owner",old.project().id()).plan());
    }
    @Test void privateInputsAndVersionMismatchAreRejectedBeforeProjectCreation() {
        var v=publish(null);assertThrows(BusinessException.class,()->service.read("other",v.id()));
        assertEquals("IP_ASSET_KEY_INVALID",assertThrows(BusinessException.class,()->service.preview("owner",use(v.id(),"foreign/private.png"))).getCode());
        var person=DapAvatar.builder().id("person").ownerUserId("owner").imageKey("own/one.png").build();when(avatars.findByIdAndOwnerUserId("person","owner")).thenReturn(Optional.of(person));
        var mismatch=new UseRequest("mine",v.id(),Map.of("character",new Value(null,new Reference(null,"person",2,"own/wrong.png","character",null))),null);
        assertThrows(BusinessException.class,()->service.preview("owner",mismatch));verify(projects,never()).create(any(),any());
    }
    @Test void unavailableEngineOrPromptFailsWithoutCreatingAnInstance() {
        var v=publish(null);when(models.resolveEndpoint(eq(AiModelPurpose.DAP_IMAGE),any(),eq("studio"))).thenReturn(Optional.empty());
        assertEquals("ENDPOINT_NOT_ALLOWED",assertThrows(BusinessException.class,()->service.instantiate("owner",use(v.id(),"own/one.png"))).getCode());verify(projects,never()).create(any(),any());
    }
    @Test void cyclicOrUndeclaredPrivateDependenciesCannotPublish() {
        var future=new Recipe(recipe.inputs(),List.of(new Step("main","b","main","image","prompt",List.of("side"),"768x1024","main",true),recipe.steps().get(1)));
        assertThrows(BusinessException.class,()->StudioTemplateService.validateRecipe(future,doc));
        var missing=new Recipe(List.of(),recipe.steps());assertThrows(BusinessException.class,()->StudioTemplateService.validateRecipe(missing,doc));
        var unsupported=new Recipe(recipe.inputs(),List.of(new Step("main","b","main","voice","prompt",List.of("character"),"768x1024","main",true)));
        assertThrows(BusinessException.class,()->StudioTemplateService.validateRecipe(unsupported,doc));
        verify(versions,never()).save(any());
    }
    @Test void textSlotsUseLiteralSubstitutionWithoutExecutingValues() {
        assertEquals("画 $1 \\ 人物",StudioTemplateService.render("画 {{style}} 人物",Map.of("style",new Value("$1 \\",null))));
        var textDoc=doc.deepCopy();((ArrayNode)textDoc.path("nodes")).addObject().put("id","t").put("type","text");
        var textRecipe=new Recipe(List.of(recipe.inputs().get(0),new Input("style","t","风格","text",true,null,null)),List.of(new Step("main","b","main","image","{{unknown}}",List.of("character"),"768x1024","main",true)));
        assertThrows(BusinessException.class,()->StudioTemplateService.validateRecipe(textRecipe,textDoc));
    }
    @Test void mixedRecipeQuotesVideosSeparatelyAndRetainsTheirSpecsWithoutPrivateMedia() {
        doc.withArray("nodes").addObject().put("id","v").put("type","video").putObject("metadata").put("videoTaskId","private-video-task");author.setDocJson(doc.toString());
        var video=new Step("video","v","商品视频","video","keep the selected image",List.of("main"),null,"video",true,5,"9:16",null);
        recipe=new Recipe(recipe.inputs(),List.of(recipe.steps().get(0),video));
        when(videos.quote(eq("owner"),any(),any(),anyString())).thenReturn(new StudioTemplateVideoService.Quote("video-model",20,false));
        var version=publish(null);var use=new UseRequest("mine",version.id(),use(version.id(),"own/one.png").inputs(),"live-image","video-model");
        var plan=service.preview("owner",use);
        assertEquals(1,plan.imageCount());assertEquals(1,plan.videoCount());assertEquals(28,plan.totalCost());assertEquals("video-model",plan.videoModel());assertEquals("waiting_adoption",plan.steps().get(1).status());assertEquals("video",plan.steps().get(1).operation());
        assertFalse(version.doc().toString().contains("private-video-task"));
        var instance=service.instantiate("owner",use);var node=IpDocs.node(instance.project().doc(),instance.plan().steps().get(1).nodeId());
        assertEquals("video",node.path("type").asText());assertEquals(5,node.path("metadata").path("seconds").asInt());verify(images,never()).generate(any(),any(),any());
    }
    @Test void videoOnlyRecipeDoesNotRequireAnImageModelAndDefersModeLimitsToTheSelectedModel() {
        doc.withArray("nodes").addObject().put("id","v").put("type","video");author.setDocJson(doc.toString());
        recipe=new Recipe(List.of(),List.of(new Step("video","v","文生视频","video","A cinematic street",List.of(),null,"video",true,5,"16:9",null)));
        when(videos.quote(eq("owner"),any(),any(),anyString())).thenReturn(new StudioTemplateVideoService.Quote("video-model",20,false));
        var version=publish(null);var plan=service.preview("owner",new UseRequest("mine",version.id(),Map.of(),null,"video-model"));
        assertNull(plan.model());assertEquals(0,plan.imageCount());assertEquals(1,plan.videoCount());verifyNoInteractions(images,models);
        var modelDefined=new Recipe(List.of(new Input("person","a","person","image",true,null,null)),List.of(new Step("video","v","video","video","prompt",List.of("person"),null,"video",true,5,"9:16",new Video("t2v","768p",null))));
        assertEquals(modelDefined,StudioTemplateService.validateRecipe(modelDefined,doc));
    }
    @Test void customVideoRecipeKeepsItsModeTierAndModelBoundInputs() {
        doc.withArray("nodes").addObject().put("id","v").put("type","video");
        var custom=new Recipe(List.of(new Input("person","a","person","image",true,null,null)),
                List.of(new Step("video","v","商品视频","video","",List.of("person"),null,"video",true,
                        40,"2:3",new Video("product-shot","portraitX",Long.MAX_VALUE))));
        var validated=StudioTemplateService.validateRecipe(custom,doc);
        var copy=StudioTemplateCanvasCopy.copy(om,StudioTemplateService.cleanDoc(doc,validated),validated);
        var metadata=copy.path("nodes").get(1).path("metadata");
        assertEquals("product-shot",metadata.path("videoMode").asText());
        assertEquals("portraitX",metadata.path("vquality").asText());
        assertEquals("2:3",metadata.path("size").asText());
    }
}
