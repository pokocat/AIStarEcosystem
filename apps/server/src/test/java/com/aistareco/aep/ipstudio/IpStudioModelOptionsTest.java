package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.controller.IpStudioController;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPricingDto;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class IpStudioModelOptionsTest {
    @Test void combinesImageResolutionPricesWithoutChangingVideoBillingUnits() {
        var runs=mock(IpRunService.class);
        var videos=mock(MaterialVideoJobService.class);
        var policies=mock(AiAppSceneModelPolicyService.class);
        when(runs.pricingDto()).thenReturn(new IpPricingDto(2,8));
        when(videos.defaultUnitCost()).thenReturn(40L);
        var controller=new IpStudioController(null,runs,null,null,null,null,videos,null,null,null,null);
        ReflectionTestUtils.setField(controller,"scenePolicies",policies);

        var oneK=image("image-1k","gpt-image-2-1k-pic",30,List.of("1024x1024","2048x2048"));
        var fourK=image("image-4k","gpt-image-2-4k-pic",45,List.of("4096x4096"));
        when(policies.available("studio","image",8L)).thenReturn(List.of(oneK,fourK));
        var video=AiModelEndpoint.builder().id("video").name("video").model("minimax-h3")
                .enabled(true).billingMode(AiModelBillingMode.PER_SECOND).build();
        var candidate=AiAppEndpointCandidate.builder().endpointId("video").creditCostOverride(40L).enabled(true).build();
        when(policies.studioVideoCandidates()).thenReturn(List.of(new AiModelInvocationService.ResolvedEndpoint(video,candidate,true)));

        var models=controller.models().data();
        assertEquals(1,models.image().size());
        var image=models.image().get(0);
        assertEquals("studio-image:gpt-image-2",image.endpointId());
        assertEquals(Map.of("1K",30L,"2K",30L,"4K",45L),image.imageResolutionCosts());
        assertEquals(3,image.capability().imageSizes().size());
        assertEquals(List.of("image-1k","image-4k"),image.legacyEndpointIds());
        assertEquals("per_second",models.video().get(0).billingUnit());
        assertEquals(40L,models.video().get(0).creditCost());
    }

    private static AiAppSceneModelPolicyService.Selection image(String id,String model,long price,List<String> sizes) {
        var spec=new AiImageRequestSpec(32000,0,16,"multiple",sizes.stream()
                .map(size->new AiImageRequestSpec.Output(size,"1:1",Map.of("size",size))).toList());
        var endpoint=AiModelEndpoint.builder().id(id).model(model).enabled(true).baseUrl("https://images.example/v1")
                .imageRequestSpecJson(spec.json()).build();
        return new AiAppSceneModelPolicyService.Selection(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,id.endsWith("1k")),price,"per_image");
    }
}
