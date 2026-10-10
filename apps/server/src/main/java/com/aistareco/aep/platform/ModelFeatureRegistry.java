package com.aistareco.aep.platform;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.common.BusinessException;
import java.util.*;
/** Registered consumers only. Shared routing stays shared; no unused scene policy is introduced. */
public final class ModelFeatureRegistry {
    private ModelFeatureRegistry() {}
    public record Feature(String appCode,String feature,String name,AiModelPurpose purpose,String routingKind,String pricingKind,String priceKey,String billingUnit,String priceSemantics,List<String> promptKeys) {
        public String key(){return appCode+"."+feature;}
    }
    public static final List<Feature> FEATURES=List.of(
        new Feature("aiavatar","real-avatar","真人素材与授权",AiModelPurpose.DAP_REAL_AVATAR,"shared_purpose","none","","per_call","not_billed",List.of()),
        new Feature("drama","appearance-forge","短剧形象顾问",AiModelPurpose.APPEARANCE_FORGE,"shared_purpose","none","","per_call","not_billed",List.of()),
        new Feature("drama","brainstorm","短剧脑暴",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","none","","per_call","not_billed",List.of()),
        new Feature("drama","hotspot","热点创作",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","none","","per_call","not_billed",List.of()),
        new Feature("drama","recipe","创作配方",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","none","","per_call","not_billed",List.of()),
        new Feature("drama","short-prompt","短视频提示词",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","none","","per_call","not_billed",List.of()),
        new Feature("celebrity","engine-pricing","旧数字人引擎售价",null,"external_engine","engine_matrix","celebrity.engine-pricing","per_call","engine_fallback",List.of()),
        new Feature("studio","script","剧本生成",AiModelPurpose.DAP_PERSONA,"scene_policy","scene_policy","","per_call","explicit_zero",List.of("dap.ip_studio_script")),
        new Feature("studio","image","图片生成",AiModelPurpose.DAP_IMAGE,"scene_policy","scene_policy","","per_image","explicit_zero",List.of("dap.ip_canvas_image")),
        new Feature("studio","speech","AI配音",AiModelPurpose.DAP_AUDIO,"shared_purpose","supplier_points","ipstudio.supplier-point-pricing","per_second","explicit_zero",List.of()),
        new Feature("studio","lip-sync","口型同步",AiModelPurpose.DAP_LIP_SYNC,"shared_purpose","supplier_points","ipstudio.supplier-point-pricing","per_second","explicit_zero",List.of()),
        new Feature("music","generate","歌曲与纯音乐生成",AiModelPurpose.MUSIC_GENERATION,"shared_purpose","candidate","","endpoint","explicit_zero",List.of()),
        new Feature("music","appearance-forge","音乐人形象设计",AiModelPurpose.APPEARANCE_FORGE,"shared_purpose","none","","per_call","not_billed",List.of()),
        new Feature("drama","outline-trial","大纲试铺",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.outline-trial","per_call","explicit_zero",List.of()),
        new Feature("drama","outline-full","完整大纲",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.outline-full","per_call","explicit_zero",List.of()),
        new Feature("drama","epscript","整集剧本重写",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.epscript","per_call","explicit_zero",List.of()),
        new Feature("drama","split-scene","单场拆镜",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.split-scene","per_call","explicit_zero",List.of()),
        new Feature("drama","cast","角色提取",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.cast","per_call","explicit_zero",List.of()),
        new Feature("drama","decompose","镜头分解",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.decompose","per_call","explicit_zero",List.of()),
        new Feature("drama","shot-rewrite","镜头改写",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.shot-rewrite","per_call","explicit_zero",List.of()),
        new Feature("drama","short-entry","短视频开拍",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.short-entry","per_call","explicit_zero",List.of()),
        new Feature("drama","interactive-draft","互动剧起草",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.interactive-draft","per_call","explicit_zero",List.of()),
        new Feature("drama","canvas-script-setting","画布故事设定",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.canvas-script-setting","per_call","explicit_zero",List.of()),
        new Feature("drama","canvas-script-outline","画布分集剧情",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.canvas-script-outline","per_call","explicit_zero",List.of()),
        new Feature("drama","canvas-script-episode","画布剧本正文",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.canvas-script-episode","per_call","explicit_zero",List.of()),
        new Feature("drama","canvas-extract","画布角色场景提取",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.canvas-extract","per_call","explicit_zero",List.of()),
        new Feature("drama","canvas-storyboard","画布分镜脚本",AiModelPurpose.DRAMA_SCRIPT_DRAFT,"shared_purpose","config","drama.credit.canvas-storyboard","per_call","explicit_zero",List.of()),
        new Feature("drama","frame","分镜图片",AiModelPurpose.IMAGE_GENERATION,"shared_purpose","candidate","drama.credit.frame","per_call","explicit_zero",List.of()),
        new Feature("drama","clip","分镜视频",AiModelPurpose.VIDEO_GENERATION,"shared_purpose","candidate","drama.credit.clip","endpoint","explicit_zero",List.of()),
        new Feature("celebrity","script-draft","带货脚本",AiModelPurpose.SCRIPT_DRAFT,"shared_purpose","action","material.script-draft","per_call","explicit_zero",List.of()),
        new Feature("celebrity","selling-points","商品卖点",AiModelPurpose.SELLING_POINTS,"shared_purpose","none","","per_call","not_billed",List.of()),
        new Feature("celebrity","variable-extract","模板变量提取",AiModelPurpose.VARIABLE_EXTRACT,"shared_purpose","none","","per_call","not_billed",List.of()),
        new Feature("celebrity","video-ref-analysis","视频拆解",AiModelPurpose.VIDEO_REF_ANALYSIS,"shared_purpose","none","","per_call","not_billed",List.of()),
        new Feature("celebrity","video-generate","素材视频生成",AiModelPurpose.VIDEO_GENERATION,"shared_purpose","action","material.video-generate","endpoint","zero_falls_back",List.of()),
        new Feature("celebrity","video-studio","视频生成区",AiModelPurpose.VIDEO_GENERATION,"shared_purpose","video_matrix","celebrity.video-studio-pricing","matrix","explicit_zero",List.of()),
        new Feature("celebrity","digital-video","数字人视频",null,"external_engine","action","celebrity.video","per_call","engine_fallback",List.of()),
        new Feature("celebrity","mixcut","混剪生成",null,"none","action","mixcut.generate","per_call","zero_falls_back",List.of()),
        new Feature("celebrity","publish","作品分发",null,"none","action","publish.upload","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","generate","形象生成",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.generate","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","generate-upload","上传形象加工",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.generate-upload","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","iterate","形象迭代",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.iterate","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","warp","形象换装",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.warp","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","look","造型生成",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.look","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","scene-generate","场景生成",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.scene-generate","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","scene-variant","场景变体",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.scene-variant","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","product-generate","产品图生成",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.product-generate","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","product-angle","产品角度",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.product-angle","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","compose","跨资产合成",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.compose","per_image","zero_falls_back",List.of()),
        new Feature("aiavatar","ip-identity","人物特征卡",AiModelPurpose.DAP_PERSONA,"shared_purpose","action","dap.ip-identity","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","ip-image","画布图片",AiModelPurpose.DAP_IMAGE,"scene_policy","scene_policy","dap.ip-image","per_image","explicit_zero",List.of()),
        new Feature("aiavatar","derive-atlas","形象图集",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.derive-atlas","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","derive-expr","表情衍生",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.derive-expr","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","derive-scene","场景衍生",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.derive-scene","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","derive-ward","服饰衍生",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.derive-ward","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","derive-d3","三维衍生",AiModelPurpose.DAP_IMAGE,"shared_purpose","action","dap.derive-d3","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","derive-video","形象视频",AiModelPurpose.DAP_VIDEO,"shared_purpose","action","dap.derive-video","per_call","zero_falls_back",List.of()),
        new Feature("aiavatar","voice-clone","专属音色",null,"external_engine","action","dap.voice-clone","per_call","zero_falls_back",List.of()));
    public static Feature require(String app,String feature) {
        return FEATURES.stream().filter(x->x.appCode().equals(app)&&x.feature().equals(feature)).findFirst().orElseThrow(()->BusinessException.badRequest("MODEL_FEATURE_NOT_REGISTERED","此应用功能尚未登记模型配置"));
    }
    public static List<String> affected(Feature f) {
        return f.purpose()==null?List.of(f.key()):FEATURES.stream().filter(x->x.purpose()==f.purpose()||secondary(x).contains(f.purpose())).map(Feature::key).sorted().toList();
    }
    public static List<AiModelPurpose> secondary(Feature f){return "aiavatar".equals(f.appCode())&&Set.of("generate","iterate","look").contains(f.feature())?List.of(AiModelPurpose.DAP_PERSONA):List.of();}
    public static List<String> priceAffected(Feature f){return FEATURES.stream().filter(x->!f.priceKey().isEmpty()&&x.priceKey().equals(f.priceKey())).map(Feature::key).sorted().toList();}
    public static void acknowledgePrice(Feature f,List<String> keys){if(keys==null || keys.size()!=new HashSet<>(keys).size() || !new HashSet<>(keys).equals(new HashSet<>(priceAffected(f))))throw BusinessException.badRequest("MODEL_FEATURE_IMPACT_REQUIRED","请确认此共享定价影响的全部功能");}
    public static void acknowledge(Feature f,List<String> keys) {
        if(keys==null || keys.size()!=new HashSet<>(keys).size() || !new HashSet<>(keys).equals(new HashSet<>(affected(f))))throw BusinessException.badRequest("MODEL_FEATURE_IMPACT_REQUIRED","请确认此共享用途影响的全部功能");
    }
}
