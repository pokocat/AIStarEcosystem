package com.aistareco.aep.ipstudio.dto;

import java.util.List;

/** Mirror of packages/types/src/ip-studio-workflow.ts. */
public final class StudioSpeechDtos {
    private StudioSpeechDtos() {}
    public record SpeechRequest(String clientRequestId, String nodeId, String model, String text,
                                String speaker, String instruct, Long maxCost, String avatarId, String voiceId, com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing) {
        public SpeechRequest(String clientRequestId,String nodeId,String model,String text,String speaker,String instruct,Long maxCost,String avatarId,String voiceId) {
            this(clientRequestId,nodeId,model,text,speaker,instruct,maxCost,avatarId,voiceId,null);
        }
        public SpeechRequest(String clientRequestId,String nodeId,String model,String text,String speaker,String instruct,Long maxCost) {
            this(clientRequestId,nodeId,model,text,speaker,instruct,maxCost,null,null);
        }
    }
    public record SpeechModel(String endpointId, String name, boolean isDefault, Long creditCost, java.math.BigDecimal creditCostPerSecond) {}
    public record SpeechVoice(String speaker, String name, String language, String description) {}
    public record SpeechCatalog(List<SpeechModel> models, List<SpeechVoice> voices,
                                int maxTextLength, int maxInstructLength) {}
}
