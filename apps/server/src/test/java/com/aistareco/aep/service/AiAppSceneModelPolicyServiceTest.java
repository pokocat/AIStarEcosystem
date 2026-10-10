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
        when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,id)).thenReturn(Optional.of(r));return r;
    }
    AiAppSceneModelPolicyDto policy(String mode,Long price){return new AiAppSceneModelPolicyDto("studio","image",mode,"a",List.of(new AiAppSceneModelPolicyDto.Candidate("a",price,"per_image")));}
    void configured(AiAppSceneModelPolicyDto p){when(config.findByKey("ai.scene-policy.studio.image")).thenReturn(Optional.of(new PlatformConfigDto("key",mapper.valueToTree(p),1,null,null,null)));}
    @Test void fixedRejectsOtherModelAndReturnsExplicitZeroSnapshot(){endpoint("a");configured(policy("fixed",0L));var selection=service.resolve("studio","image",null,8);assertEquals(0,selection.creditCost());configured(policy("fixed",22L));assertEquals(0,selection.creditCost());assertThrows(BusinessException.class,()->service.resolve("studio","image","b",8));}
    @Test void selectableRejectsOutsideWhitelistAndDisabledEndpoint(){endpoint("a");configured(policy("selectable",9L));assertEquals(9,service.resolve("studio","image",null,8).creditCost());assertThrows(BusinessException.class,()->service.resolve("studio","image","b",8));when(models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,"a")).thenReturn(Optional.empty());assertThrows(BusinessException.class,()->service.resolve("studio","image",null,8));assertTrue(service.available("studio","image",8).isEmpty());}
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
    void jusuanOnly(){when(config.findByKey(AiAppSceneModelPolicyService.STUDIO_PROVIDER_KEY)).thenReturn(Optional.of(new PlatformConfigDto("key",mapper.valueToTree("jusuan"),1,null,null,null)));}
    @Test void supplierRestrictionFiltersCatalogAndRejectsExplicitNonJusuanEvenWithMisleadingName(){
        jusuanOnly();var jusuan=endpoint("a");jusuan.endpoint().setBaseUrl("https://api.jusuanhub.com/v1");
        var other=endpoint("b");other.endpoint().setBaseUrl("https://api.agnes-ai.cn/v1");other.endpoint().setName("jusuan");
        when(models.listCandidates(AiModelPurpose.DAP_IMAGE)).thenReturn(List.of(jusuan,other));
        assertEquals(List.of("a"),service.available("studio","image",30).stream().map(r->r.resolved().endpoint().getId()).toList());
        assertThrows(BusinessException.class,()->service.resolve("studio","image","b",30));
        other.endpoint().setBaseUrl("https://api.jusuanhub.com.evil.example/v1");assertFalse(service.allowsStudioProvider(other.endpoint()));
        other.endpoint().setBaseUrl("https://user@api.jusuanhub.com/v1");assertFalse(service.allowsStudioProvider(other.endpoint()));
    }
    @Test void scenePolicyCannotReintroduceAnotherSupplier(){
        jusuanOnly();var r=endpoint("a");r.endpoint().setBaseUrl("https://other.example/v1");configured(policy("fixed",30L));
        assertTrue(service.available("studio","image",30).isEmpty());
        assertThrows(BusinessException.class,()->service.resolve("studio","image",null,30));
        assertThrows(BusinessException.class,()->service.save("studio","image",policy("fixed",30L),"test"));
    }
    @Test void videoDefaultAndSubmissionUseAllowedSupplierWithoutChangingGlobalDefault(){
        jusuanOnly();var allowed=endpoint("a");allowed.endpoint().setBaseUrl("https://api.jusuanhub.com/v1");
        var other=endpoint("b");other.endpoint().setBaseUrl("https://other.example/v1");
        when(models.listCandidates(AiModelPurpose.VIDEO_GENERATION)).thenReturn(List.of(new AiModelInvocationService.ResolvedEndpoint(other.endpoint(),other.candidate(),true),allowed));
        assertEquals(1,service.studioVideoCandidates().size());assertTrue(service.studioVideoCandidates().get(0).isDefault());
        assertEquals("a",service.resolveStudioVideo(null).endpoint().getId());
        assertThrows(BusinessException.class,()->service.resolveStudioVideo("b"));
        allowed.endpoint().setEnabled(false);assertTrue(service.studioVideoCandidates().isEmpty());assertThrows(BusinessException.class,()->service.resolveStudioVideo(null));
    }
    @Test void invalidSupplierConfigFailsClosed(){
        when(config.findByKey(AiAppSceneModelPolicyService.STUDIO_PROVIDER_KEY)).thenReturn(Optional.of(new PlatformConfigDto("key",mapper.valueToTree("unknown"),1,null,null,null)));
        assertThrows(BusinessException.class,()->service.allowsStudioProvider(endpoint("a").endpoint()));
    }
}
