package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioTemplateExecutionServiceTest {
    final ObjectMapper om=new ObjectMapper();
    final StudioTemplateService templates=mock(StudioTemplateService.class);final IpProjectService projects=mock(IpProjectService.class);
    final StudioWorkflowService workflow=mock(StudioWorkflowService.class);final IpRunService images=mock(IpRunService.class);final FileStorageService storage=mock(FileStorageService.class);
    StudioTemplateExecutionService service;IpProject p;Map<String,IpRun> jobs=new HashMap<>();
    final StudioTemplateVideoService videos=mock(StudioTemplateVideoService.class);
    @BeforeEach void setup() throws Exception {
        service=new StudioTemplateExecutionService(templates,projects,workflow,images,storage,om,videos);
        var recipe=new Recipe(List.of(new Input("character","a","person","image",true,null,null)),List.of(new Step("main","b","main","image","main prompt",List.of("character"),"768x1024","main",true),new Step("side","c","side","image","side prompt",List.of("main"),"768x1024","side",false)));
        var plan=new Plan("v1",1,"model",16,2,List.of(new PlanStep("main","main","b1","main",8,"ready",List.of(),true),new PlanStep("side","side","c1","side",8,"waiting_adoption",List.of("main"),false)));
        var instance=new Instance(null,new Version("v1","t",1,"pack","","personal",recipe,om.createObjectNode(),"today"),plan);
        var snapshot=om.createObjectNode();snapshot.set("inputs",om.valueToTree(Map.of("character",new Value(null,new Reference(null,null,null,"own/input.png","character",null)))));
        p=IpProject.builder().id("p").ownerUserId("owner").templateInstanceJson(snapshot.toString()).templateVersionId("v1").build();
        when(projects.required("owner","p")).thenReturn(p);when(projects.requiredForUpdate("owner","p")).thenReturn(p);when(templates.instance("owner","p")).thenReturn(instance);
        when(projects.parseOrEmptyObject(anyString())).thenAnswer(i->om.readTree(i.getArgument(0,String.class)));
        when(projects.requireOwnedAssetKey(eq("owner"),anyString())).thenAnswer(i->i.getArgument(1));
        when(images.compileExplicit(eq("owner"),any())).thenReturn(new IpRunService.Compiled("generate",8,1,"image",om.createObjectNode(),false,true,"key"));
        when(projects.ownedRun(eq("owner"),eq("p"),anyString())).thenAnswer(i->Optional.ofNullable(jobs.get(i.getArgument(2))));
        when(projects.toRunDto(any())).thenAnswer(i->dto(i.getArgument(0)));
        when(storage.signedUrl(anyString())).thenAnswer(i->"url/"+i.getArgument(0));
        when(workflow.submit(eq("owner"),eq("p"),any())).thenAnswer(i->{RunRequest r=i.getArgument(2);String id="r"+jobs.size();var row=IpRun.builder().id(id).nodeId(r.nodeId()).status("running").inputJson(om.valueToTree(r).toString()).outputJson("{}").build();jobs.put(id,row);return dto(row);});
    }
    IpRunDto dto(IpRun row)throws Exception{return new IpRunDto(row.getId(),"p",row.getNodeId(),"generate",row.getStatus(),"stage",0,8,null,null,om.readTree(row.getInputJson()),om.readTree(row.getOutputJson()),"today",null);}
    IpRunDto start(String step,String key,String replace){return service.execute("owner","p",step,new ExecuteRequest(key,8L,replace));}
    void finish(String id,String key) {var job=jobs.get(id);job.setStatus("done");var output=om.createObjectNode();output.putArray("candidates").addObject().put("key",key);job.setOutputJson(output.toString());}
    void accept(String step,String id,String key){service.accept("owner","p",step,new AcceptRequest(id,key,true));}
    @Test void downstreamCannotChargeBeforeAnExplicitMainAcceptance() {
        assertEquals("STUDIO_TEMPLATE_DEPENDENCY_REQUIRED",assertThrows(BusinessException.class,()->start("side","s",null)).getCode());
        var main=start("main","m",null);finish(main.id(),"own/main.png");
        assertEquals("STUDIO_TEMPLATE_ADOPTION_REQUIRED",assertThrows(BusinessException.class,()->start("side","s",null)).getCode());
        accept("main",main.id(),"own/main.png");var side=start("side","s",null);
        var req=om.convertValue(projects.parseOrEmptyObject(jobs.get(side.id()).getInputJson()),RunRequest.class);
        assertEquals("own/main.png",req.references().get(0).storageKey());assertNull(req.references().get(0).avatarId());
    }
    @Test void refreshAndReplayQuerySameRunIncludingAfterLaterReplacement() {
        var one=start("main","same",null);assertEquals(one.id(),start("main","same",null).id());
        assertEquals(one.id(),service.read("owner","p").steps().get(0).run().id());
        assertEquals("STUDIO_TEMPLATE_RUNNING",assertThrows(BusinessException.class,()->start("main","other",one.id())).getCode());
        finish(one.id(),"own/old.png");var two=start("main","second",one.id());assertNotEquals(one.id(),two.id());assertEquals(one.id(),start("main","same",null).id());verify(workflow,times(2)).submit(any(),any(),any());
    }
    @Test void priceChangeOrMissingCeilingFailsBeforeNativeHold() {
        assertEquals("STUDIO_PRICE_CHANGED",assertThrows(BusinessException.class,()->service.execute("owner","p","main",new ExecuteRequest("low",7L,null))).getCode());
        assertEquals("STUDIO_TEMPLATE_COST_REQUIRED",assertThrows(BusinessException.class,()->service.execute("owner","p","main",new ExecuteRequest("missing",null,null))).getCode());verifyNoInteractions(workflow);
    }
    @Test void acceptedMainReplacementMarksDependentOutputStaleAndPreservesOriginalJobs() {
        var main=start("main","m",null);finish(main.id(),"own/main.png");accept("main",main.id(),"own/main.png");var side=start("side","s",null);finish(side.id(),"own/side.png");assertTrue(service.read("owner","p").complete());
        var newer=start("main","new",main.id());finish(newer.id(),"own/new.png");accept("main",newer.id(),"own/new.png");var view=service.read("owner","p");
        assertEquals("done",view.steps().get(0).status());assertEquals("stale",view.steps().get(1).status());assertEquals(side.id(),view.steps().get(1).run().id());assertEquals("own/side.png",view.steps().get(1).storageKey());assertFalse(view.complete());assertEquals("done",jobs.get(main.id()).getStatus());
        assertThrows(BusinessException.class,()->accept("side",side.id(),"own/side.png"));
    }
    @Test void failedStepNeedsExplicitCompareAndSetRetryAndDoesNotRetryParents() {
        var main=start("main","m",null);jobs.get(main.id()).setStatus("failed");assertEquals("failed",service.read("owner","p").steps().get(0).status());
        assertEquals("STUDIO_TEMPLATE_REPLACE_REQUIRED",assertThrows(BusinessException.class,()->start("main","new",null)).getCode());assertNotEquals(main.id(),start("main","new",main.id()).id());verify(workflow,times(2)).submit(any(),any(),any());
    }
    @Test void unknownOutputsAndChangedReplayCannotBeAdoptedOrSubmitted() {
        var main=start("main","m",null);finish(main.id(),"own/main.png");assertThrows(BusinessException.class,()->accept("main",main.id(),"own/foreign.png"));
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.execute("owner","p","main",new ExecuteRequest("m",9L,null))).getCode());
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->start("side","m",null)).getCode());verify(workflow,times(1)).submit(any(),any(),any());
    }
    @Test void derivedImageCannotSilentlyReplaceTheMainIdentityWhenArchiving() {
        var m=start("main","m",null);finish(m.id(),"own/main.png");accept("main",m.id(),"own/main.png");var s=start("side","s",null);finish(s.id(),"own/side.png");
        assertEquals("STUDIO_TEMPLATE_ARCHIVE_INTENT",assertThrows(BusinessException.class,()->service.archive("owner","p","side",new AdoptRequest("c1","own/side.png","side",null,null,null,"main"))).getCode());verify(workflow,never()).adopt(any(),any(),any());
    }
    @Test void perInstancePromptOverrideKeepsRecipeReferencesAndReplayBodyImmutable() {
        var request=new ExecuteRequest("edited",8L,null,"  exact head close-up  ");
        var first=service.execute("owner","p","main",request);
        var actual=om.convertValue(projects.parseOrEmptyObject(jobs.get(first.id()).getInputJson()),RunRequest.class);
        assertEquals("exact head close-up",actual.prompt());assertEquals("own/input.png",actual.references().get(0).storageKey());
        assertEquals(first.id(),service.execute("owner","p","main",request).id());
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.execute("owner","p","main",new ExecuteRequest("edited",8L,null,"other prompt"))).getCode());
        assertEquals("main prompt",templates.instance("owner","p").source().recipe().steps().get(0).prompt());verify(workflow,times(1)).submit(any(),any(),any());
    }
    @Test void oldRequestWithoutNewNullablePromptCanStillRecoverAfterUpgrade() throws Exception {
        var first=start("main","old",null);var persisted=(com.fasterxml.jackson.databind.node.ObjectNode)om.readTree(p.getTemplateInstanceJson());
        var body=(com.fasterxml.jackson.databind.node.ObjectNode)persisted.path("templateRequests").path("old").path("request");body.putNull("replaceRunId");body.remove("prompt");p.setTemplateInstanceJson(persisted.toString());
        assertEquals(first.id(),start("main","old",null).id());verify(workflow,times(1)).submit(any(),any(),any());
    }
    @Test void adoptedImageFeedsVideoAndReplayRestoresTheSameNativeJobAndCandidate() throws Exception {
        var original=templates.instance("owner","p");
        var video=new Step("video","v","商品视频","video","original video prompt",List.of("main"),null,"video",true,5,"9:16",null);
        var plan=new Plan("v1",1,"model",28,1,List.of(original.plan().steps().get(0),new PlanStep("video","video","v1","video",20,"waiting_adoption",List.of("main"),true,"video")),"video-model",1);
        when(templates.instance("owner","p")).thenReturn(new Instance(null,new Version("v1","t",1,"video pack","","personal",new Recipe(original.source().recipe().inputs(),List.of(original.source().recipe().steps().get(0),video)),om.createObjectNode(),"today"),plan));
        when(videos.quote(eq("owner"),eq(video),eq("video-model"),anyString())).thenReturn(new StudioTemplateVideoService.Quote("video-model",20,false));
        var req=new ExecuteRequest("video-key",20L,null,"edited video instruction");
        assertEquals("STUDIO_TEMPLATE_DEPENDENCY_REQUIRED",assertThrows(BusinessException.class,()->service.execute("owner","p","video",req)).getCode());
        var main=start("main","main-key",null);finish(main.id(),"own/frame.png");
        assertEquals("STUDIO_TEMPLATE_ADOPTION_REQUIRED",assertThrows(BusinessException.class,()->service.execute("owner","p","video",req)).getCode());
        accept("main",main.id(),"own/frame.png");var run=service.execute("owner","p","video",req);
        var request=om.readValue(jobs.get(run.id()).getInputJson(),RunRequest.class);
        assertEquals("video",request.operation());assertEquals("video-model",request.model());assertEquals("own/frame.png",request.references().get(0).storageKey());assertEquals(5,request.durationSec());assertEquals("9:16",request.aspectRatio());
        jobs.get(run.id()).setStatus("done");jobs.get(run.id()).setOutputJson("{\"videoCandidates\":[{\"status\":\"done\",\"storageKey\":\"own/result.mp4\"}]}");
        var waiting=service.read("owner","p").steps().get(1);assertEquals("waiting_adoption",waiting.status());assertEquals("own/result.mp4",waiting.storageKey());
        accept("video",run.id(),"own/result.mp4");assertTrue(service.read("owner","p").complete());
        assertEquals(run.id(),service.execute("owner","p","video",req).id());verify(workflow,times(2)).submit(any(),any(),any());
        assertEquals("STUDIO_TEMPLATE_ARCHIVE_INTENT",assertThrows(BusinessException.class,()->service.archive("owner","p","video",new AdoptRequest("v1","own/result.mp4","video",null,null,null,"main"))).getCode());
        var newer=start("main","replacement",main.id());finish(newer.id(),"own/new-frame.png");accept("main",newer.id(),"own/new-frame.png");
        assertEquals("stale",service.read("owner","p").steps().get(1).status());assertEquals("own/result.mp4",service.read("owner","p").steps().get(1).storageKey());
    }
}
