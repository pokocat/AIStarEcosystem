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
    private final ClipPricingService pricingSource;
    public ClipEstimateService(ClipProperties props, ClipProjectService projects, ClipAvatarService avatars, ClipAssetService assets, ClipPricingService pricingSource) { this.props = props; this.projects = projects; this.avatars = avatars; this.assets = assets; this.pricingSource = pricingSource; }
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
        // 与 pricing() 读同一处。**不能各读各的** —— 端上按 pricing() 的数算报价，
        // 这里按另一组核对，差一分钱就是每次生成都 409（见 ClipPricingService 类注释）。
        PricingDto price=pricingSource.resolved();
        int avatarRate=price.creditPerAvatarSecond();
        int ttsRate=price.creditPerKChar();
        int assemble=price.creditPerAssemble();
        int tts=(int)Math.ceil(chars / 1000d * ttsRate), avatar=avatarSec * avatarRate;
        EstimateSummary summary=new EstimateSummary(totalSec,avatarSec,tailSec,avatarCount,brollCount,tailCount,chars);
        return new EstimateDto(List.of(new EstimateItem("tts","口播配音",tts,null),new EstimateItem("avatar","分身出镜 "+avatarSec+" 秒",avatar,null),new EstimateItem("tail","结尾固定段",0,"免费"),new EstimateItem("assemble","总装",assemble,null)),tts+avatar+assemble,summary);
    }

    /**
     * 六档单价一次性出 wire。**任一档没配就在这里 503**，不给端上一张半真的价目表 ——
     * 少一档端上读到 undefined，算出来是 NaN，用户看到的就是「NaN 钻石」。
     */
    public PricingDto pricing() { return pricingSource.resolved(); }

    /**
     * 一镜单独生成的报价：**只算这一次调用真正产出的东西**（出镜秒数 / 图张数 / 视频秒数）。
     *
     * <p>为什么不把配音摊进来：整片 estimate 的 TTS 是 {@code ceil(全片字数/1000 × 单价)}，
     * 全片只取一次整。按镜摊就变成每镜各取一次整，十个短镜头能把同样的字数收成十倍
     * —— 那不是计价，是罚款。配音仍按整片一次结算，{@code creditPerKChar} 照常出 wire 给端上算。
     */
    public int shotQuote(String model, Map<String,Object> shot) {
        PricingDto price=pricing(); int sec=ClipProjectService.seconds(shot);
        return switch(model==null?"":model) {
            case "avatar" -> sec*price.creditPerAvatarSecond();
            case "t2i" -> price.creditPerImage();
            case "t2v" -> sec*price.creditPerT2vSecond();
            case "i2v" -> sec*price.creditPerI2vSecond();
            default -> throw BusinessException.badRequest("CLIP_SHOT_MODEL_INVALID","不支持的分段生成模型");
        };
    }
    /** 总装单独下单时的那一档。与整片 estimate 里的 assemble 同价，避免两条路径能被套利。 */
    // 同样走 resolver：这是合成整片那一步真正扣的数，读 props 就会和端上看到的价对不上。
    public int assembleQuote() { return pricingSource.resolved().creditPerAssemble(); }
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
