package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.dto.ClipDtos.*;
import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class ClipEstimateService {
    private final ClipProperties props; private final ClipProjectService projects; private final ClipAvatarService avatars; private final ClipAssetService assets;
    public ClipEstimateService(ClipProperties props, ClipProjectService projects, ClipAvatarService avatars, ClipAssetService assets) { this.props = props; this.projects = projects; this.avatars = avatars; this.assets = assets; }
    public EstimateDto estimate(String owner, String id, List<Map<String, Object>> override, List<Map<String, Object>> overrideShots) {
        ClipProject p = projects.required(owner, id);
        Map<String,Object> payload = new LinkedHashMap<>(p.getPayloadJson());
        if (override != null) payload.put("segments", override);
        if (overrideShots != null) payload.put("shots", overrideShots);
        List<Map<String, Object>> segments = ClipShotPlan.materialize(payload);
        int totalSec=0, avatarSec=0, tailSec=0, avatarCount=0, brollCount=0, tailCount=0, chars=0;
        for (Map<String,Object> row: segments) {
            String role=String.valueOf(row.get("role")); int sec=ClipProjectService.seconds(row); totalSec += sec;
            if ("avatar".equals(role)) { avatarSec += sec; avatarCount++; }
            else if ("broll".equals(role)) brollCount++;
            else if ("tail".equals(role)) { tailSec += sec; tailCount++; }
            if (!"tail".equals(role)) chars += String.valueOf(row.getOrDefault("text", "")).replaceAll("\\s", "").length();
        }
        int avatarRate=props.requirePrice(props.getPricingAvatarSecond(), "avatar-second");
        int ttsRate=props.requirePrice(props.getPricingTtsPerKchar(), "tts-per-kchar");
        int assemble=props.requirePrice(props.getPricingAssemble(), "assemble");
        int tts=(int)Math.ceil(chars / 1000d * ttsRate), avatar=avatarSec * avatarRate;
        EstimateSummary summary=new EstimateSummary(totalSec,avatarSec,tailSec,avatarCount,brollCount,tailCount,chars);
        return new EstimateDto(List.of(new EstimateItem("tts","口播配音",tts,null),new EstimateItem("avatar","分身出镜 "+avatarSec+" 秒",avatar,null),new EstimateItem("tail","结尾固定段",0,"免费"),new EstimateItem("assemble","总装",assemble,null)),tts+avatar+assemble,summary);
    }
    public void preflight(String owner, ClipProject p) {
        List<Map<String,Object>> segments=ClipShotPlan.materialize(p.getPayloadJson());
        if (segments.isEmpty()) throw BusinessException.badRequest("CLIP_NO_SEGMENTS","文案还是空的");
        boolean hasAvatar=false, hasSpeech=false;
        for (Map<String,Object> row:segments) {
            String role=String.valueOf(row.get("role"));
            if (!"tail".equals(role)) hasSpeech=true;
            if (!"tail".equals(role) && String.valueOf(row.getOrDefault("text", "")).isBlank()) throw BusinessException.badRequest("CLIP_EMPTY_TEXT","文案中还有空句");
            if ("avatar".equals(role)) { hasAvatar=true; if (ClipProjectService.seconds(row)>props.getMaxAvatarSegmentSec()) throw BusinessException.badRequest("CLIP_SEGMENT_TOO_LONG","单个出镜段超过引擎时长上限"); }
            if ("broll".equals(role)) {
                if (row.get("assetId")==null || String.valueOf(row.get("assetId")).isBlank()) throw BusinessException.badRequest("CLIP_ASSET_NOT_ALLOWED","配画面段还有未选择的素材");
                assets.requiredVisible(owner,String.valueOf(row.get("assetId")));
            }
        }
        String avatarId = ClipDtos.string(p.getPayloadJson().get("avatarId"));
        String voiceId = ClipDtos.string(p.getPayloadJson().get("voiceId"));
        if (hasAvatar && !avatars.ready(owner, avatarId)) throw new BusinessException(org.springframework.http.HttpStatus.CONFLICT,"CLIP_AVATAR_NOT_READY","所选形象还没有训练完成");
        if (hasSpeech && !avatars.voiceReady(owner, avatarId, voiceId)) throw new BusinessException(org.springframework.http.HttpStatus.CONFLICT,"CLIP_VOICE_NOT_READY","所选数字人还没有可用声音，请先关联或补录声音");
    }
}
