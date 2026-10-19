package com.aistareco.aep.ipstudio.dto;
import java.util.List;
/** Mirror of packages/types/src/ip-studio-workflow.ts. */
public final class StudioVoiceDtos {
    private StudioVoiceDtos(){}
    public record VoiceProfile(String voiceId,String avatarId,String name,int version,String speaker,String instruct,String demoUrl,String demoStorageKey,String sourceRunId){}
    public record VoicePerformer(String avatarId,String ipId,String name,String voiceId){}
    public record VoiceCatalog(List<VoicePerformer> performers,List<VoiceProfile> profiles){}
    public record AdoptVoiceRequest(String runId,String avatarId,String name,String expectedVoiceId){}
    public record BindVoiceRequest(String voiceId,String expectedVoiceId){}
}
