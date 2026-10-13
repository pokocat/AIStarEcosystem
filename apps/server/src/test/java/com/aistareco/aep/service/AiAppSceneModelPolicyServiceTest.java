package com.aistareco.aep.service;
import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class AiAppSceneModelPolicyServiceTest {
    final PlatformConfigService config=mock(PlatformConfigService.class);
    final AiModelInvocationService models=mock(AiModelInvocationService.class);
    final ObjectMapper mapper=new ObjectMapper();
    final AiAppSceneModelPolicyService service=new AiAppSceneModelPolicyService(config,models,mapper);
    AiModelInvocationService.ResolvedEndpoint endpoint(String id) {
        var ep=AiModelEndpoint.builder().id(id).enabled(true).build();
        var candidate=AiAppEndpointCandidate.builder().endpointId(id).enabled(true).build();
        var r=new AiModelInvocationService.ResolvedEndpoint(ep,candidate,false);
        when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,id,"studio")).thenReturn(Optional.of(r));return r;
    }
    AiAppSceneModelPolicyDto policy(String mode,Long price){return new AiAppSceneModelPolicyDto("studio","image",mode,"a",List.of(new AiAppSceneModelPolicyDto.Candidate("a",price,"per_image")));}
    void configured(AiAppSceneModelPolicyDto p){when(config.findByKey("ai.scene-policy.studio.image")).thenReturn(Optional.of(new PlatformConfigDto("key",mapper.valueToTree(p),1,null,null,null)));}
    @Test void fixedRejectsOtherModelAndReturnsExplicitZeroSnapshot(){endpoint("a");configured(policy("fixed",0L));var selection=service.resolve("studio","image",null,8);assertEquals(0,selection.creditCost());configured(policy("fixed",22L));assertEquals(0,selection.creditCost());assertThrows(BusinessException.class,()->service.resolve("studio","image","b",8));}
    @Test void selectableRejectsOutsideWhitelistAndDisabledEndpoint(){endpoint("a");configured(policy("selectable",9L));assertEquals(9,service.resolve("studio","image",null,8).creditCost());assertThrows(BusinessException.class,()->service.resolve("studio","image","b",8));when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"a","studio")).thenReturn(Optional.empty());assertThrows(BusinessException.class,()->service.resolve("studio","image",null,8));assertTrue(service.available("studio","image",8).isEmpty());}
    @Test void missingPriceCannotBecomeFree(){endpoint("a");configured(policy("fixed",null));assertThrows(BusinessException.class,()->service.resolve("studio","image",null,8));assertThrows(BusinessException.class,()->service.save("studio","image",policy("fixed",null),"test"));}
    @Test void invalidDefaultAndFixedMultipleRejected(){endpoint("a");var c=policy("fixed",8L).candidates();assertThrows(BusinessException.class,()->service.save("studio","image",new AiAppSceneModelPolicyDto("studio","image","selectable","b",c),"test"));assertThrows(BusinessException.class,()->service.save("studio","image",new AiAppSceneModelPolicyDto("studio","image","fixed","a",List.of(c.get(0),new AiAppSceneModelPolicyDto.Candidate("b",9L,"per_image"))),"test"));}
    @Test void absentPolicyPreservesLegacyPriceAndBindings(){var r=endpoint("a");when(config.findByKey(anyString())).thenReturn(Optional.empty());assertEquals(8,service.resolve("studio","image","a",8).creditCost());assertSame(r,service.resolve("studio","image","a",8).resolved());}
    @Test void unsupportedSceneCannotBeSaved(){assertThrows(BusinessException.class,()->service.get("drama","video"));}
    @Test void pricePatchPreservesRoutesWithoutResolvingDisabledModels(){
        configured(policy("fixed",8L));
        var result=service.savePrices("studio","image",List.of(new AiAppSceneModelPolicyDto.Candidate("a",0L,"per_image")),"operator");
        assertEquals("fixed",result.mode());assertEquals("a",result.defaultEndpointId());assertEquals(0L,result.candidates().get(0).creditCost());
        verify(config).lockExisting("ai.scene-policy.studio.image");verifyNoInteractions(models);
        assertThrows(BusinessException.class,()->service.savePrices("studio","image",List.of(new AiAppSceneModelPolicyDto.Candidate("outside",4L,"per_image")),"operator"));
        assertThrows(BusinessException.class,()->service.savePrices("studio","image",List.of(new AiAppSceneModelPolicyDto.Candidate("a",4L,"per_call")),"operator"));
    }
    @Test void appScopeFiltersLegacyCatalogAndExplicitSelection(){
        var selected=endpoint("a");var hidden=endpoint("b");
        when(models.listCandidates(AiModelPurpose.DAP_IMAGE,"studio")).thenReturn(List.of(selected));
        when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"b","studio")).thenReturn(Optional.empty());
        assertEquals(List.of("a"),service.available("studio","image",30).stream().map(r->r.resolved().endpoint().getId()).toList());
        assertThrows(BusinessException.class,()->service.resolve("studio","image","b",30));
        assertThrows(BusinessException.class,()->service.save("studio","image",new AiAppSceneModelPolicyDto("studio","image","fixed","b",List.of(new AiAppSceneModelPolicyDto.Candidate("b",30L,"per_image"))),"test"));
    }
    @Test void configuredImageSceneCanUseAgnesWithoutChangingLegacyOrVideoSupplierScope(){
        var agnes=endpoint("a");agnes.endpoint().setBaseUrl("https://api.agnes-ai.cn/v1");
        when(models.listCandidates(AiModelPurpose.DAP_IMAGE,"studio")).thenReturn(List.of(agnes));
        var saved=service.save("studio","image",policy("fixed",30L),"test");
        assertEquals("a",saved.defaultEndpointId());
        configured(saved);
        assertEquals(List.of("a"),service.available("studio","image",30).stream().map(r->r.resolved().endpoint().getId()).toList());
        assertEquals("a",service.resolve("studio","image",null,30).resolved().endpoint().getId());
        assertEquals(30,service.resolve("studio","image","a",30).creditCost());
        when(models.listCandidates(AiModelPurpose.VIDEO_GENERATION,"studio")).thenReturn(List.of(agnes));
        assertTrue(service.studioVideoCandidates().isEmpty());
    }
    @Test void videoGroupControlsCatalogAndSubmissionWithoutChangingGlobalDefault(){
        var allowed=endpoint("a");var other=endpoint("b");
        var group=new AiAppSceneModelPolicyService.VideoGroup("a",List.of("a"));
        when(config.findByKey("ai.app-model-group.studio.video")).thenReturn(Optional.of(new PlatformConfigDto("key",mapper.valueToTree(group),1,null,null,null)));
        when(models.listCandidates(AiModelPurpose.VIDEO_GENERATION,"studio")).thenReturn(List.of(new AiModelInvocationService.ResolvedEndpoint(other.endpoint(),other.candidate(),true),allowed));
        assertEquals(1,service.studioVideoCandidates().size());assertTrue(service.studioVideoCandidates().get(0).isDefault());
        assertEquals("a",service.resolveStudioVideo(null).endpoint().getId());
        assertThrows(BusinessException.class,()->service.resolveStudioVideo("b"));
        allowed.endpoint().setEnabled(false);assertTrue(service.studioVideoCandidates().isEmpty());assertThrows(BusinessException.class,()->service.resolveStudioVideo(null));
    }
    @Test void invalidVideoGroupFailsClosed(){
        when(config.findByKey("ai.app-model-group.studio.video")).thenReturn(Optional.of(new PlatformConfigDto("key",mapper.valueToTree(new AiAppSceneModelPolicyService.VideoGroup("outside",List.of("a"))),1,null,null,null)));
        assertThrows(BusinessException.class,service::studioVideoCandidates);
    }
}
