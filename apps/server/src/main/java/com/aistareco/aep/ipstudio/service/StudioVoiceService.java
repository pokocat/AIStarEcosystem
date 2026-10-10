package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.model.*;
import com.aistareco.aep.dap.repository.*;
import com.aistareco.aep.ipstudio.dto.StudioVoiceDtos.*;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.Files;
import java.time.Instant;
import java.util.*;

/** Official presets become immutable, owned DapVoice versions; adoption never trains or synthesizes. */
@Service
public class StudioVoiceService {
    private final DapVoiceRepository voices;private final DapAvatarRepository avatars;
    private final IpRunRepository runs;private final IpProjectService projects;private final FileStorageService storage;private final ObjectMapper mapper;
    public StudioVoiceService(DapVoiceRepository voices,DapAvatarRepository avatars,IpRunRepository runs,IpProjectService projects,FileStorageService storage,ObjectMapper mapper) {
        this.voices=voices;this.avatars=avatars;this.runs=runs;this.projects=projects;this.storage=storage;this.mapper=mapper;
    }
    @Transactional(readOnly=true) public VoiceCatalog catalog(String owner) {
        var profiles=voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner,"qwen3-tts").stream().filter(StudioVoiceService::usable).map(this::dto).toList();
        var performers=avatars.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(owner).stream()
                .map(a->new VoicePerformer(a.getId(),a.getIpId(),a.getName(),profiles.stream().anyMatch(v->v.avatarId().equals(a.getId())&&v.voiceId().equals(a.getVoiceId()))?a.getVoiceId():null)).toList();
        return new VoiceCatalog(performers,profiles);
    }
    @Transactional public VoiceProfile adopt(String owner,String projectId,AdoptVoiceRequest request) {
        projects.requiredForUpdate(owner,projectId);
        if(request==null||blank(request.runId())||blank(request.avatarId())||blank(request.name())||request.name().trim().length()>64)throw bad("STUDIO_VOICE_INPUT_INVALID","请选择人物并填写声音名称（最多 64 字）");
        var run=runs.findByIdAndOwnerUserId(request.runId(),owner).filter(r->projectId.equals(r.getProjectId())&&"studio-audio".equals(r.getKind())&&IpRun.STATUS_DONE.equals(r.getStatus()))
                .orElseThrow(()->bad("STUDIO_VOICE_SOURCE_INVALID","请使用当前项目已完成的真实配音"));
        var avatar=requiredAvatar(owner,request.avatarId(),true);
        var existing=voices.findByOwnerUserIdAndAvatarIdAndSourceRunId(owner,avatar.getId(),run.getId()).orElse(null);
        // A replay returns its original version and cannot revert a more recent default.
        if(existing!=null){if(existing.getDeletedAt()!=null||!usable(existing))throw bad("STUDIO_VOICE_UNAVAILABLE","原声音版本已不可用");return dto(existing);}
        requireExpected(avatar,request.expectedVoiceId());
        JsonNode input=read(run.getInputJson()),output=read(run.getOutputJson());
        String speaker=input.path("speaker").asText(),key=output.path("storageKey").asText();double duration=output.path("durationSec").asDouble();
        if(blank(speaker)||blank(key)||!output.path("mimeType").asText().startsWith("audio/")||!Double.isFinite(duration)||duration<=0)throw bad("STUDIO_VOICE_SOURCE_INVALID","配音缺少可试听的真实音频");
        long bytes;try{bytes=Files.size(storage.openForRead(key));}catch(Exception e){throw bad("STUDIO_VOICE_SOURCE_INVALID","配音文件暂时不可读取，请稍后重试");}
        if(bytes<=0)throw bad("STUDIO_VOICE_SOURCE_INVALID","配音文件为空");
        int seconds=(int)Math.ceil(duration);
        var voice=DapVoice.builder().id("VC-"+UUID.randomUUID().toString().replace("-","").substring(0,20)).ownerUserId(owner).avatarId(avatar.getId())
                .name(request.name().trim()).kind("preset").engine("qwen3-tts").engineRef(speaker).engineStatus("ready")
                .profileVersion(voices.lastProfileVersion(owner,avatar.getId())+1).stylePrompt(style(input.path("instruct").asText(null)))
                .sourceRunId(run.getId()).audioKey(key).demoAudioCdnKey(key).bytes(bytes).dur(String.format("%02d:%02d",seconds/60,seconds%60)).createdAt(Instant.now()).build();
        voices.save(voice);bind(avatar,voice);return dto(voice);
    }
    @Transactional public VoiceProfile bindDefault(String owner,String avatarId,BindVoiceRequest request) {
        if(request==null||blank(request.voiceId()))throw bad("STUDIO_VOICE_INPUT_INVALID","请选择声音版本");
        var avatar=requiredAvatar(owner,avatarId,true);var voice=requiredProfile(owner,avatarId,request.voiceId());
        if(!request.voiceId().equals(avatar.getVoiceId())){requireExpected(avatar,request.expectedVoiceId());bind(avatar,voice);}return dto(voice);
    }
    public DapAvatar requiredAvatar(String owner,String avatarId,boolean lock) {
        var result=lock?avatars.lockOwned(avatarId,owner):avatars.findByIdAndOwnerUserId(avatarId,owner);
        return result.filter(a->a.getDeletedAt()==null).orElseThrow(()->bad("STUDIO_VOICE_AVATAR_INVALID","人物不存在或不属于当前账号"));
    }
    public DapVoice requiredProfile(String owner,String avatarId,String voiceId) {
        if(blank(avatarId))throw bad("STUDIO_VOICE_AVATAR_INVALID","请选择声音所属人物");
        requiredAvatar(owner,avatarId,false);
        return voices.findByIdAndOwnerUserId(voiceId,owner).filter(v->avatarId.equals(v.getAvatarId())&&v.getDeletedAt()==null&&usable(v))
                .orElseThrow(()->bad("STUDIO_VOICE_UNAVAILABLE","所选人物声音版本不可用，请重新选择"));
    }
    private void bind(DapAvatar avatar,DapVoice voice){avatar.setVoiceId(voice.getId());avatar.setVoiceName(voice.getName());avatar.setUpdatedAt(Instant.now());avatars.save(avatar);}
    private VoiceProfile dto(DapVoice voice){return new VoiceProfile(voice.getId(),voice.getAvatarId(),voice.getName(),voice.getProfileVersion(),voice.getEngineRef(),voice.getStylePrompt(),storage.signedUrl(voice.getDemoAudioCdnKey()),voice.getDemoAudioCdnKey(),voice.getSourceRunId());}
    private static boolean usable(DapVoice voice){return "preset".equals(voice.getKind())&&"qwen3-tts".equals(voice.getEngine())&&"ready".equals(voice.getEngineStatus())&&voice.getProfileVersion()!=null&&!blank(voice.getEngineRef());}
    private static void requireExpected(DapAvatar avatar,String expected){if(!Objects.equals(avatar.getVoiceId(),style(expected)))throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_VOICE_CHANGED","人物默认声音已改变，请刷新后再确认");}
    public static String style(String value){return blank(value)?null:value.trim();}
    private static boolean blank(String value){return value==null||value.isBlank();}
    private static BusinessException bad(String code,String message){return BusinessException.badRequest(code,message);}
    private JsonNode read(String value){try{return mapper.readTree(value);}catch(Exception e){throw bad("STUDIO_VOICE_SOURCE_INVALID","配音记录无法读取");}}
}
