package com.aistareco.aep.platform;
import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.*;
import com.aistareco.aep.config.MusicGenProperties;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.videostudio.service.VideoStudioPricingService;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class ModelFeatureManagementServiceTest {
    final ObjectMapper mapper=new ObjectMapper();
    final AiAppBindingService bindings=mock(AiAppBindingService.class);
    final CelebrityActionPricingService prices=mock(CelebrityActionPricingService.class);
    final PlatformConfigService config=mock(PlatformConfigService.class);
    final StudioPlatformPricing platform=mock(StudioPlatformPricing.class);
    final StudioPointPricing point=mock(StudioPointPricing.class);
    final AiModelEndpointAdminService endpoints=mock(AiModelEndpointAdminService.class);
    final CelebrityZoneService zone=mock(CelebrityZoneService.class);
    final MusicGenProperties music=new MusicGenProperties();
    ModelFeatureManagementService service(){return new ModelFeatureManagementService(bindings,prices,config,mock(VideoStudioPricingService.class),mapper,music,zone,platform,mock(DapPricingService.class),point,endpoints,mock(AiAppSceneModelPolicyService.class),20);}
    AiAppEndpointCandidateDto candidate(String id){return new AiAppEndpointCandidateDto("DAP_LIP_SYNC","lip",id,"模型",true,false,1,true,null,12L,null);}
    PlatformConfigDto row(String key,JsonNode value){return new PlatformConfigDto(key,value,1,null,null,null);}
    @Test void registryRejectsUnknownAndAcknowledgesAllSharedConsumers(){
        assertThrows(Exception.class,()->ModelFeatureRegistry.require("star","generate"));
        var appearance=ModelFeatureRegistry.require("music","appearance-forge");assertTrue(ModelFeatureRegistry.affected(appearance).contains("drama.appearance-forge"));
        var script=ModelFeatureRegistry.require("studio","script");assertTrue(ModelFeatureRegistry.affected(script).contains("aiavatar.generate"));
        assertThrows(Exception.class,()->ModelFeatureRegistry.acknowledge(appearance,List.of("music.appearance-forge")));
        assertEquals("scene_policy",ModelFeatureRegistry.require("aiavatar","ip-image").routingKind());
        assertEquals("per_call",ModelFeatureRegistry.require("drama","frame").billingUnit());
    }
    @Test void actionPatchPreservesOtherEntriesAndOldEngineFlag() throws Exception {
        var raw=mapper.readTree("{\"material.script-draft\":{\"creditPrice\":3,\"useEnginePricing\":false},\"celebrity.video\":{\"creditPrice\":0,\"useEnginePricing\":true},\"unrelated\":{\"creditPrice\":99,\"useEnginePricing\":false}}");
        when(config.findByKey(CelebrityActionPricingService.ACTION_PRICING_CONFIG_KEY)).thenReturn(Optional.of(row("k",raw)));when(prices.getAll()).thenReturn(Map.of());
        service().saveAction("celebrity","digital-video",new ActionPricingDto(8L,null));
        var cap=ArgumentCaptor.forClass(Map.class);verify(prices).replaceAll(cap.capture());var result=cap.getValue();assertEquals(new ActionPricingDto(99L,false),result.get("unrelated"));assertEquals(new ActionPricingDto(8L,true),result.get("celebrity.video"));verify(config).lockExisting(CelebrityActionPricingService.ACTION_PRICING_CONFIG_KEY);
    }
    @Test void fixedCustomerPointPatchUsesGlobalFirstWriteGuardAndPreservesHistory() throws Exception {
        when(bindings.listCandidates(AiModelPurpose.DAP_LIP_SYNC)).thenReturn(List.of(candidate("a")));
        var existing=mapper.readTree("{\"endpointCosts\":{\"a\":9},\"supplierToPlatformRatio\":3,\"markupPercent\":20,\"customerPrices\":{\"b\":4}}");
        when(config.findByKey(StudioPointPricing.KEY)).thenReturn(Optional.of(row("k",existing)));
        service().saveSupplierPoint("studio","lip-sync","a",BigDecimal.ZERO,"actor");
        var cap=ArgumentCaptor.forClass(JsonNode.class);verify(config).upsert(eq(StudioPointPricing.KEY),cap.capture(),anyString(),eq("actor"));assertEquals(4,cap.getValue().path("customerPrices").path("b").intValue());assertEquals(0,cap.getValue().path("customerPrices").path("a").intValue());assertEquals(9,cap.getValue().path("endpointCosts").path("a").intValue());
        var order=inOrder(config);order.verify(config).lockRequired(CelebrityActionPricingService.ACTION_PRICING_CONFIG_KEY);order.verify(config).lockExisting(StudioPointPricing.KEY);order.verify(config).findByKey(StudioPointPricing.KEY);
        assertThrows(Exception.class,()->service().saveSupplierPoint("studio","lip-sync","outside",BigDecimal.ONE,"actor"));
    }
    @Test void priceReaderShowsEffectiveRateWithoutSupplierCostAndRejectsRuntimeOverride() throws Exception {
        when(bindings.listCandidates(AiModelPurpose.DAP_LIP_SYNC)).thenReturn(List.of(candidate("a")));
        when(point.find("a")).thenReturn(new StudioPointPricing.Rate(null,null,null,new BigDecimal("2.5"),null,null,null));
        when(config.findByKey(StudioPointPricing.KEY)).thenReturn(Optional.of(row("k",mapper.readTree("{\"endpointCosts\":{\"a\":100},\"supplierToPlatformRatio\":20,\"customerPrices\":{\"a\":2.5}}"))));
        var json=mapper.valueToTree(service().pricing("studio","lip-sync"));var c=json.path("value").get(0);assertEquals(new BigDecimal("2.5"),c.path("creditPrice").decimalValue());assertEquals("fixed",c.path("priceSource").asText());assertFalse(json.toString().contains("endpointCosts"));assertFalse(json.toString().contains("supplierToPlatformRatio"));
        when(platform.enabled()).thenReturn(true);assertEquals("runtime_snapshot",mapper.valueToTree(service().pricing("studio","speech")).path("pricingKind").asText());assertThrows(Exception.class,()->service().saveSupplierPoint("studio","speech","a",BigDecimal.ONE,"actor"));
    }
    @Test void missingConfigShowsActualFallbackAndMusicDefaultWithoutPersistingIt(){
        var s=service();var drama=mapper.valueToTree(s.pricing("drama","outline-trial"));assertTrue(drama.path("value").isNull());assertEquals(6L,drama.path("fallback").longValue());
        music.setDefaultCreditsPerSecond(7);var m=mapper.valueToTree(s.pricing("music","generate"));assertEquals(7L,m.path("fallback").longValue());verify(config,never()).upsert(any(),any(),any(),any());
    }
    @Test void pricingCatalogContainsSafeMetadataAndPricesWithoutModelRouteRead(){
        when(bindings.listCandidates(any())).thenReturn(List.of());when(prices.getAll()).thenReturn(Map.of());when(config.findByKey(anyString())).thenReturn(Optional.empty());
        var rows=mapper.valueToTree(service().pricingCatalog());assertTrue(rows.size()>40);for(var row:rows){assertTrue(row.path("binding").isNull());assertTrue(row.path("candidates").isEmpty());assertTrue(row.has("pricing"));assertFalse(row.toString().contains("baseUrl"));}
        verify(bindings,never()).list();
    }
    @Test void absentGlobalSeedPreventsFirstSupplierWrite(){
        when(bindings.listCandidates(AiModelPurpose.DAP_LIP_SYNC)).thenReturn(List.of(candidate("a")));doThrow(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE)).when(config).lockRequired(CelebrityActionPricingService.ACTION_PRICING_CONFIG_KEY);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service().saveSupplierPoint("studio","lip-sync","a",BigDecimal.ONE,"actor"));verify(config,never()).findByKey(StudioPointPricing.KEY);verify(config,never()).upsert(any(),any(),any(),any());
    }
    @Test void engineSalePatchPreservesSupplierQuotaAndReadNeverProjectsIt(){
        when(zone.getEnginePricing()).thenReturn(Map.of("KeLing",new EnginePricingDto(50,9),"HiGen",new EnginePricingDto(120,3)));
        var s=service();var json=mapper.valueToTree(s.pricing("celebrity","engine-pricing"));assertEquals(50,json.path("value").path("KeLing").path("creditPrice").intValue());assertFalse(json.toString().contains("quotaCost"));
        s.saveEngine("celebrity","engine-pricing","KeLing",8);var cap=ArgumentCaptor.forClass(Map.class);verify(zone).adminReplaceEnginePricing(cap.capture());assertEquals(new EnginePricingDto(8,9),cap.getValue().get("KeLing"));assertEquals(new EnginePricingDto(120,3),cap.getValue().get("HiGen"));
    }
}
