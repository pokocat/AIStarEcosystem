package com.aistareco.aep.dto;
import java.util.List;
/** User sale prices are independent of provider billing costs. */
public record AiAppSceneModelPolicyDto(String appCode,String scene,String mode,String defaultEndpointId,List<Candidate> candidates) {
    public record Candidate(String endpointId,Long creditCost,String billingUnit) {}
}
