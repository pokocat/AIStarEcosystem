package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.service.StudioVideoBreakdown;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;

/**
 * AI 视频页的爆款复刻，拉片之后的制作方案（docs/ip-studio-recreation.md「代码拼制作方案」）。
 *
 * <p>线上 2026-11-07 至 11-09 的 12 条复刻任务里，8 条停在「写分镜脚本 / 生成」：模型自己写整份方案，清晰度写成别的模型的、
 * 一步塞两三段原片、引用画布上不存在的素材、方案读不出来。现在分段、时长、模型、清晰度、画幅和每段用哪段原片、哪张图做什么，
 * 全部由这里按拉片结果和用户在页面上选的设置拼好；模型只写每段的提示词和字幕（提示词库 stage-recreation-compile）。
 * 拼出来的方案仍走 {@code StudioPlanValidator.validateSkillPlan}、报价和指纹，和模型写的方案同一条路。
 */
public final class StudioRecreationTaskPlan {
    public static final int MAX_IMAGES = com.aistareco.aep.ipstudio.scene.StudioSceneCatalog.RECREATION_MAX_IMAGES;
    public static final int MAX_VOICES = 1;
    public static final int MAX_MATERIALS = MAX_IMAGES + MAX_VOICES;

    public static boolean acceptsVoice(VideoStudioModeSpec mode, boolean clip) {
        var refs=mode.references();
        return refs!=null&&refs.audio()!=null&&refs.audio().maxCount()>0
                &&(refs.maxTotal()<=0||refs.maxTotal()>(clip?1:0));
    }
    private static final ObjectMapper OM=new ObjectMapper();
    private StudioRecreationTaskPlan() {}

    /** 用户在视频页上传的一份素材（SegmentedMaterial）。slot：image | character | voice。 */
    public record Material(String nodeId,String title,String slot) {}

    /**
     * 受理「写分镜脚本」那一步时冻结的事实（存进 {@code _exec.recreationTask}），worker 用它和模型写的提示词拼方案。
     *
     * <p>原片片段不交给视频模型（2026-11-09 真实出片：H3 全能参考带上原片这一段，就照着原片把原商品、平台水印和字幕全画出来，
     * 用户的杯子一次都没出现；提示词写了「不参考商品外观、文字和水印」也不管用）。原片的动作、景别、节奏、台词都写进逐镜提示词，
     * 片段只留在画布上给人看。
     *
     * @param film      拉片输出（filmStudy，带 breakdown）
     */
    public static ObjectNode prepare(JsonNode film,List<Material> materials,String model,
                                     VideoStudioContract contract,String tier,String ratio,Boolean optimize) {
        return prepare(film,materials,model,contract,tier,ratio,optimize,null,0,"");
    }

    /**
     * @param framePrefix 拉片截下的镜头开场画面的节点编号前缀（{@code StudioPlanExecutionIds.frameNodeId} 去掉镜号）；null 不做开场画面
     * @param maxKeyframes 整条片最多做几张开场画面（技能的步数上限减去视频、检查和合成步骤）
     */
    public static ObjectNode prepare(JsonNode film,List<Material> materials,String model,
                                     VideoStudioContract contract,String tier,String ratio,Boolean optimize,
                                     String framePrefix,int maxKeyframes,String requirement) {
        return prepare(film,materials,model,contract,tier,ratio,optimize,framePrefix,maxKeyframes,requirement,"recreation",null);
    }

    /**
     * @param method       爆款复刻的方式（{@link StudioCloneVideoPlan}）：recreation 分镜复刻 / depth 深度复刻 / replacement 元素替换
     * @param segmentPrefix 拉片切好的原片片段的节点编号前缀（{@code StudioPlanExecutionIds.segmentNodeId} 去掉段号）；深度复刻和元素替换必填
     */
    public static ObjectNode prepare(JsonNode film,List<Material> materials,String model,
                                     VideoStudioContract contract,String tier,String ratio,Boolean optimize,
                                     String framePrefix,int maxKeyframes,String requirement,String method,String segmentPrefix) {
        if(contract==null)throw unavailable("所选视频模型不可用，请换一个模型");
        boolean clip=StudioCloneVideoPlan.nativeClone(method);
        if(clip&&segmentPrefix==null)throw new IllegalArgumentException("segment prefix");
        // 深度复刻 / 元素替换每段都带一段参考视频：只用能带参考视频的模式。元素替换不做开场画面；
        // 深度复刻只做一张「场景图」（第一段开场截图换成用户的人和商品），每段都带上它，各段的人、商品、场景和光线才一致
        // （2026-11-11 真跑：三段分开生成，第三段换了个房间）。
        boolean depthScene="depth".equals(method);
        if(clip&&!depthScene)framePrefix=null;
        VideoStudioModeSpec mode=clip?clipMode(contract):mode(contract,materials!=null&&!materials.isEmpty()||framePrefix!=null&&film.path("frames").size()>0);
        String chosenTier=contract.tiers().stream().anyMatch(t->t.tier().equals(tier))?tier:contract.tiers().get(0).tier();
        ObjectNode task=OM.createObjectNode().put("model",model).put("mode",mode.mode()).put("tier",chosenTier).put("ratio",ratio==null?"9:16":ratio);
        task.put("method",clip?method:"recreation");
        if(optimize!=null)task.put("optimize",optimize);
        task.put("requirement",requirement==null?"":requirement.strip());
        // 原片一直挂在画面上的标题条（拉片的 screenTitle）：成片放在顶部，不当字幕
        String screenTitle=film.path("breakdown").path("screenTitle").asText("").strip();
        if(!screenTitle.isEmpty()&&!ORIGINAL_ACCOUNT.matcher(screenTitle).find())task.put("screenTitle",screenTitle.length()>40?screenTitle.substring(0,40):screenTitle);
        var refs=mode.references();
        // 素材顺序：人物在前（同一个人的图集中在一起），再商品 / 场景图，最后声音。
        List<Material> people=new ArrayList<>(),images=new ArrayList<>(),voices=new ArrayList<>();
        for(Material m:materials){switch(m.slot()==null?"image":m.slot()){case "character" -> people.add(m);case "voice" -> voices.add(m);default -> images.add(m);}}
        List<Material> pictures=new ArrayList<>(people);pictures.addAll(images);
        var materialArray=task.putArray("materials");
        for(Material m:materials)materialArray.addObject().put("nodeId",m.nodeId()).put("title",blank(m.title())?"素材":m.title()).put("slot",slotLabel(m.slot()));
        JsonNode shots=film.path("breakdown").path("shots");
        Set<Integer> framed=new HashSet<>();
        if(framePrefix!=null&&refs!=null&&refs.image()!=null)for(JsonNode f:film.path("frames"))if(f.hasNonNull("storageKey"))framed.add(f.path("shot").asInt());
        int keyframesLeft=Math.max(0,depthScene?Math.min(1,maxKeyframes):maxKeyframes);
        String sceneStep=null;
        var units=task.putArray("units");
        double offset=0;
        for(JsonNode segment:film.path("segments")) {
            int no=segment.path("no").asInt();
            // 整段都是原作者的账号片尾：深度复刻和元素替换会把这段原片交给视频模型，照着它只会再拍一遍别人的片尾，这段不做
            if(clip&&accountCardOnly(shots,segment))continue;
            double start=segment.path("startSec").asDouble(),end=segment.path("endSec").asDouble(),length=end-start;
            int seconds=(int)Math.max(contract.minSeconds(),Math.min(contract.maxSeconds(),Math.round(length)));
            ObjectNode unit=units.addObject().put("no",no).put("title",segment.path("title").asText("第 "+no+" 段")).put("startSec",start).put("endSec",end)
                    .put("seconds",seconds).put("offsetSec",offset).put("firstShot",segment.path("firstShot").asInt()).put("lastShot",segment.path("lastShot").asInt());
            offset+=seconds;
            var bindings=unit.putArray("refs");int order=0;
            var keyframes=unit.putArray("keyframes");
            if(clip) {
                // 视频1：深度复刻是这段原片转成的动作参考（d<段号> 那一步的产物），元素替换就是这段原片
                String clipNode=segmentPrefix+no;
                unit.put("clipNodeId",clipNode);
                var video=bindings.addObject();
                if("depth".equals(method))video.put("stepId","d"+no);else video.put("nodeId",clipNode);
                video.put("role","reference-video").put("order",order++).put("label","视频1").put("what","depth".equals(method)
                        ?"原片这一段的动作参考：灰色深度图或黑底彩色火柴人骨骼图，只取人物位置、动作、节奏和镜头运动，画面本身不出现"
                        :"原片这一段：要保留的画面，只换掉用户要换的人或物");
            }
            if(refs!=null) {
                int imageLimit=refs.image()==null?0:refs.image().maxCount();
                // 带参考视频时图片张数另有上限
                if(clip&&refs.maxImagesWithVideo()>0)imageLimit=Math.min(imageLimit,refs.maxImagesWithVideo());
                int total=refs.maxTotal()>0?refs.maxTotal():Integer.MAX_VALUE;
                boolean useVoice=!voices.isEmpty()&&acceptsVoice(mode,clip);
                int visualTotal=total-(useVoice?MAX_VOICES:0);
                int n=1;
                // 开场画面在前：原片每个镜头的开场截图改成用户的人物和商品，视频模型从这张图开始拍（2026-11-10 美食那条实测，
                // 「手指捏住远处很小的人」这类借位靠文字写不出来，靠图就摆出来了）。放不下时，有视觉把戏的镜头和长镜头优先。
                // 深度复刻：后面几段不再做新图，带上第一段做的那张场景图
                if(depthScene&&sceneStep!=null&&n<=imageLimit&&order<visualTotal) {
                    bindings.addObject().put("stepId",sceneStep).put("role","reference-image").put("order",order++).put("label","图"+n)
                            .put("what","场景图：原片开场画面换成了用户的人物和商品，人物外观、穿着、商品、场景和光线都照它");
                    unit.put("sceneStepId",sceneStep);
                    n++;
                }
                int limit=Math.min(Math.min(imageLimit-n+1,visualTotal-order),keyframesLeft);
                // 场景图取第一段最开头那一镜（不按视觉把戏、镜头长短挑）
                List<Integer> picked=depthScene?keyframeShots(shots,segment,framed,Integer.MAX_VALUE).stream().limit(limit).toList()
                        :keyframeShots(shots,segment,framed,limit);
                for(int shot:picked) {
                    JsonNode s=shots.get(shot-1);
                    String label="图"+n,stepId="k"+shot;
                    keyframes.addObject().put("shot",shot).put("label",label).put("stepId",stepId).put("frameNodeId",framePrefix+shot)
                            .put("atSec",round(Math.max(0,Math.min(seconds,s.path("start").asDouble()-start))))
                            .put("hasTrick",!s.path("detail").path("trick").asText("").isBlank())
                            .put("layout",s.path("detail").path("layout").asText("")).put("trick",s.path("detail").path("trick").asText(""))
                            .put("detail",StudioVideoBreakdown.detailText(s));
                    bindings.addObject().put("stepId",stepId).put("role","reference-image").put("order",order++).put("label",label)
                            .put("what",depthScene?"场景图：原片开场画面换成了用户的人物和商品，人物外观、穿着、商品、场景和光线都照它"
                                    :"第 "+shot+" 镜改好的开场画面（这一镜从这张图开始拍）");
                    if(depthScene){sceneStep=stepId;unit.put("sceneStepId",stepId);}
                    n++;keyframesLeft--;
                }
                for(Material m:pictures) {
                    if(n>imageLimit||order>=visualTotal)break;
                    bindings.addObject().put("nodeId",m.nodeId()).put("role","character".equals(m.slot())?"character":"reference-image").put("order",order++)
                            .put("label","图"+n).put("what",(blank(m.title())?"素材":m.title())+"（"+slotLabel(m.slot())+"）");
                    n++;
                }
                if(useVoice) {
                    Material voice=voices.get(0);
                    bindings.addObject().put("nodeId",voice.nodeId()).put("role","reference-audio").put("order",order)
                            .put("label","音频1").put("what",(blank(voice.title())?"声音":voice.title())+"（说话的声音）");
                }
            }
            // 这段里重复用的画面：某一镜推到某一刻的画面，就是这段另一镜的开场画面（StudioVideoBreakdown.markSameFrames）。
            // 那张开场画面在这段的参考图里，写提示词时就能写「推到这里就是图N」；不在这段的（别的段、没做开场画面的）不提。
            Map<Integer,String> labelOf=new HashMap<>();
            for(JsonNode k:keyframes)labelOf.put(k.path("shot").asInt(),k.path("label").asText());
            var same=unit.putArray("sameFrames");
            for(int i=segment.path("firstShot").asInt();i<=segment.path("lastShot").asInt()&&i<shots.size();i++)
                for(JsonNode e:shots.get(i).path("sameFrames")) {
                    int of=e.path("shot").asInt();double at=e.path("at").asDouble(Double.NaN);
                    if(!labelOf.containsKey(of)||of==i+1||!Double.isFinite(at)||at<start||at>end)continue;
                    same.addObject().put("shot",i+1).put("atSec",round(at-start)).put("of",of).put("label",labelOf.get(of));
                }
        }
        if(units.isEmpty())throw BusinessException.badRequest("STUDIO_RECREATION_NO_SEGMENTS","拉片没有得到可用的分段，请重新开始");
        return task;
    }

    /**
     * 这段里做开场画面的镜头（镜号从 1 起，按时间排）：截到了画面、不是原作者的账号片尾。超过 {@code limit} 张时，
     * 细读写了视觉把戏的镜头优先，其次是长的镜头。
     */
    static List<Integer> keyframeShots(JsonNode shots,JsonNode segment,Set<Integer> framed,int limit) {
        if(limit<=0||framed.isEmpty())return List.of();
        List<Integer> candidates=new ArrayList<>();
        for(int i=segment.path("firstShot").asInt();i<=segment.path("lastShot").asInt()&&i<shots.size();i++) {
            JsonNode s=shots.get(i);
            if(!framed.contains(i+1)||accountCard(s))continue;
            candidates.add(i+1);
        }
        if(candidates.size()>limit) {
            List<Integer> ranked=new ArrayList<>(candidates);
            ranked.sort(Comparator.<Integer>comparingInt(no->shots.get(no-1).path("detail").path("trick").asText("").isBlank()?1:0)
                    .thenComparingDouble(no->-(shots.get(no-1).path("end").asDouble()-shots.get(no-1).path("start").asDouble())));
            Set<Integer> kept=new HashSet<>(ranked.subList(0,limit));
            candidates.removeIf(no->!kept.contains(no));
        }
        return candidates;
    }

    /** 这段的镜头全是原作者的账号页或平台片尾。 */
    static boolean accountCardOnly(JsonNode shots,JsonNode segment) {
        int first=segment.path("firstShot").asInt(),last=segment.path("lastShot").asInt();
        if(first<0||last<first||first>=shots.size())return false;
        for(int i=first;i<=last&&i<shots.size();i++)if(!accountCard(shots.get(i)))return false;
        return true;
    }

    /** 深度复刻 / 元素替换用的模式：能带参考视频、不要首尾帧。 */
    static VideoStudioModeSpec clipMode(VideoStudioContract contract) {
        for(var m:contract.modes())if(m.references()!=null&&m.references().video()!=null&&m.references().video().maxCount()>0&&!m.needsFirstFrame()&&!m.needsLastFrame())return m;
        throw BusinessException.badRequest("STUDIO_CLONE_REFERENCE_UNSUPPORTED","当前模型不支持视频参考，请更换模型或使用分镜复刻。");
    }

    /** 原作者的账号页、平台片尾这类镜头不做开场画面（复刻时它换成收尾画面，ORIGINAL_ACCOUNT 同一条规则）。 */
    static boolean accountCard(JsonNode shot) {
        return ORIGINAL_ACCOUNT.matcher(shot.path("visual").asText("")+" "+shot.path("caption").asText("")).find();
    }

    /** 交给模型（stage-recreation-compile）的变量。 */
    public static Map<String,Object> variables(JsonNode task,JsonNode breakdown,String requirement) {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("requirement",blank(requirement)?"把原片的人物和商品换成我的素材，其它照原片。":requirement.strip());
        List<Map<String,Object>> materials=new ArrayList<>();
        // 素材编号只在每段里出现（每段的图1 可能不同）；这里列素材本身，不编号。
        for(JsonNode m:task.path("materials"))materials.add(Map.of("label","「"+m.path("title").asText()+"」","title",slotName(m.path("slot").asText()),"slot","用户上传的替换素材"));
        out.put("materials",materials);
        String report=StudioVideoBreakdown.report(breakdown);
        out.put("breakdown",report.length()>20000?report.substring(0,20000):report);
        List<Map<String,Object>> units=new ArrayList<>();
        for(JsonNode u:task.path("units")) {
            List<Map<String,Object>> refs=new ArrayList<>();
            for(JsonNode r:u.path("refs"))refs.add(Map.of("label",r.path("label").asText(),"what",r.path("what").asText()));
            if(refs.isEmpty())refs.add(Map.of("label","（无）","what","这段没有参考素材，只按文字描述拍"));
            List<Map<String,Object>> keyframes=new ArrayList<>();
            for(JsonNode k:u.path("keyframes"))keyframes.add(Map.of("shot",k.path("shot").asInt(),"label",k.path("label").asText(),
                    "detail",k.path("detail").asText("").isBlank()?"":"原片这一镜："+k.path("detail").asText()));
            Map<String,Object> unit=new LinkedHashMap<>();
            unit.put("no",u.path("no").asInt());
            unit.put("range",StudioVideoBreakdown.range(u.path("startSec").asDouble(),u.path("endSec").asDouble()));
            unit.put("seconds",u.path("seconds").asInt());unit.put("refs",refs);
            unit.put("hasKeyframes",!keyframes.isEmpty());unit.put("keyframes",keyframes);
            unit.put("sameFrames",sameFrames(u));
            unit.put("shots",StudioVideoBreakdown.shotTable(breakdown,u.path("firstShot").asInt(),u.path("lastShot").asInt(),u.path("startSec").asDouble(),
                    u.path("startSec").asDouble(),u.path("endSec").asDouble()));
            units.add(unit);
        }
        out.put("units",units);
        return out;
    }

    /**
     * 模型写的每段提示词 + 冻结的事实 → 方案（和模型写方案时同一种结构，随后照常校验、报价）。
     * 缺了哪一段的提示词就整份判失败（AI_BAD_OUTPUT，按实际用量结算、可以重试），不拿拉片原文顶替。
     */
    private static String slotName(String slot) {
        return switch(slot==null?"":slot){case "character"->"人物照片";case "voice","audio"->"声音";case "video"->"视频";default->"图片";};
    }

    /** 原片作者的账号、平台号和平台片尾：不进用户的成片（2026-11-09 真跑：美食那条把原作者的抖音号写进了字幕）。 */
    static final java.util.regex.Pattern ORIGINAL_ACCOUNT=java.util.regex.Pattern.compile(
            "(抖音|快手|小红书|视频号|B站|b站|微博|微信)\\s*(号|搜索|ID|id)|来(抖音|快手|小红书)|[0-9]{7,}|@\\S");

    public static ObjectNode build(JsonNode task,JsonNode answer) {return build(task,answer,null);}

    /** 方案里由代码写的文字，从提示词库取：环节名 + 变量 → 正文。worker 传受理时冻结的版本。 */
    @FunctionalInterface
    public interface Texts {String render(String stage,Map<String,Object> vars);}

    /** 没有冻结版本时直接用提示词库的当前版本（老调用和测试）。 */
    static final Texts LIBRARY=(stage,vars)->com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.or(null)
            .assemble(com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.Call.of(stage,vars,null,null)).user();

    /** 检查每段成片时看的几项（技能 reference-video-recreation 的 checks 里挑的）。 */
    static final List<String> CHECK_IDS=List.of("subject-replaced","old-subject-residue","character-consistency","scene-and-action");

    /**
     * @param texts 开场画面的出图描述（stage-recreation-keyframe，变量 layout / trick / refs / instruction）和检查要点
     *              （stage-recreation-keyframe-check / -video-check）从这里取；null 时不做开场画面，检查要点用提示词库的当前版本（老调用和测试）
     */
    public static ObjectNode build(JsonNode task,JsonNode answer,Texts texts) {
        Texts library=texts==null?LIBRARY:texts;
        Map<Integer,JsonNode> written=new HashMap<>();
        for(JsonNode u:answer.path("units"))if(u.path("prompt").isTextual()&&!u.path("prompt").asText().isBlank())written.putIfAbsent(u.path("no").asInt(),u);
        String method=task.path("method").asText("recreation");
        boolean depth="depth".equals(method),replacement="replacement".equals(method);
        String videoMethod=depth?"depth-control":replacement?"element-replace":null;
        ObjectNode plan=OM.createObjectNode();
        plan.put("summary",text(answer.path("summary"),depth?"照原片的动作和镜头重拍，换成你的素材":replacement?"保留原片画面，换掉你要换的东西":"按原片的分段和节奏复刻，换成你的素材",1000));
        var approach=plan.putArray("approaches").addObject().put("id","remake").put("title",depth?"照原片动作重拍":replacement?"保留原片替换元素":"照原片分段复刻")
                .put("summary",depth?"原片每段转成动作参考（深度图或骨骼图）交给视频模型，人和商品换成你的素材，原片的台词和节奏写进每段的提示词。"
                        :replacement?"原片每段直接交给视频模型，只换掉你点名的人或物，其余画面、动作和节奏照原片。"
                        :"按拉片的真实镜头分段，原片的场景、动作和节奏写进每段的提示词，人和商品换成你的素材。")
                .put("rationale","分段、时长和每段用哪些素材由系统按拉片结果定，模型只写每段的提示词。");
        approach.set("preserve",strings(answer.path("keep")));approach.set("change",strings(answer.path("change")));
        plan.put("recommendedApproachId","remake");
        var materialIds=plan.putArray("materialNodeIds");
        for(JsonNode m:task.path("materials"))materialIds.add(m.path("nodeId").asText());
        var steps=plan.putArray("steps");
        var clipOrder=OM.createArrayNode();
        var captions=OM.createArrayNode();
        double last=0;
        // 用户关了「自动检查」：开场画面、场景图和成片都不检查
        boolean autoCheck=task.path("autoCheck").asBoolean(true);
        Map<String,Integer> checkedKeyframes=texts==null||!autoCheck?Map.of():keyframeChecks(task);
        List<String> sceneDeps=new ArrayList<>();
        for(JsonNode u:task.path("units")) {
            int no=u.path("no").asInt();
            JsonNode w=written.get(no);
            if(w==null)throw BusinessException.wrapped(org.springframework.http.HttpStatus.BAD_GATEWAY,"AI_BAD_OUTPUT","模型没有写完每一段的提示词，这次没有完成。请重试",
                    "missing unit "+no+" of "+task.path("units").size());
            String id="v"+no;
            // 开场画面：每张一个出图步骤，以原片这一镜的截图为构图基准，参照写提示词的模型挑的素材
            boolean makeKeyframes=texts!=null&&u.path("keyframes").size()>0;
            List<String> keyframeSteps=new ArrayList<>();
            if(makeKeyframes) {
                Map<Integer,JsonNode> asked=new HashMap<>();
                for(JsonNode k:w.path("keyframes"))asked.putIfAbsent(k.path("shot").asInt(),k);
                for(JsonNode k:u.path("keyframes")) {
                    int shot=k.path("shot").asInt();
                    JsonNode a=asked.get(shot);
                    String instruction=a==null?"":a.path("instruction").asText("").strip();
                    if(instruction.isBlank())instruction=blank(task.path("requirement").asText(""))?"把画面里要换的人和物换成参考图里的样子，其它保持原样":task.path("requirement").asText().strip();
                    ObjectNode image=steps.addObject().put("id",k.path("stepId").asText()).put("operation","image").put("title",depth?"场景图":"第 "+shot+" 镜开场画面").put("execution","auto");
                    image.putObject("strategy").put("approachId","remake").put("method","keyframe-rebuild").put("reason","原片第 "+shot+" 镜");
                    image.putArray("dependsOn");image.putArray("referenceNodeIds");
                    ObjectNode imageSettings=image.putObject("settings").put("operation","image").put("aspectRatio",task.path("ratio").asText()).put("count",1);
                    var imageBindings=imageSettings.putArray("referenceBindings");
                    imageBindings.addObject().put("nodeId",k.path("frameNodeId").asText()).put("role","reference-image").put("order",1);
                    List<Map<String,Object>> refs=new ArrayList<>();
                    int order=2;
                    List<JsonNode> named=materialsNamed(task,a==null?null:a.path("materials"));
                    // 深度复刻的场景图：写提示词的模型没点名素材时，图片素材都带上（人在前）
                    if(named.isEmpty()&&depth)for(JsonNode m:task.path("materials"))if(!"声音".equals(m.path("slot").asText()))named.add(m);
                    for(JsonNode m:named) {
                        if(order>5)break;
                        imageBindings.addObject().put("nodeId",m.path("nodeId").asText()).put("role","reference-image").put("order",order);
                        refs.add(Map.of("label","图"+order,"what",m.path("title").asText()+"（"+m.path("slot").asText()+"）"));
                        order++;
                    }
                    Map<String,Object> vars=new LinkedHashMap<>();
                    vars.put("layout",k.path("layout").asText(""));vars.put("trick",k.path("trick").asText(""));
                    vars.put("refs",refs);vars.put("instruction",instruction.length()>600?instruction.substring(0,600):instruction);
                    image.put("prompt",texts.render(com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints.RECREATION_KEYFRAME,vars).strip());
                    keyframeSteps.add(k.path("stepId").asText());
                    // 改好的开场画面先看一遍再出片：人换对了没有、有没有留着原片人物的帽子衣服、远处的人有没有被画大。不合格只重出这一张图
                    // （StudioSegmentedRun），比等视频出完再发现便宜得多（2026-11-10 美食那条：第 6 镜的开场画面戴着原片的贝雷帽，带进了成片）。
                    // 这些检查是可省的（optionalRank）：报价放不下页面批准的上限时，进入制作前按名次从后往前省掉（StudioPlanExecutionService）。
                    Integer rank=checkedKeyframes.get(k.path("stepId").asText());
                    if(rank!=null) {
                        String checkId="c"+k.path("stepId").asText();
                        ObjectNode check=steps.addObject().put("id",checkId).put("operation","check").put("title",(depth?"场景图":"第 "+shot+" 镜开场画面")+" · 检查")
                                .put("prompt",library.render(com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints.RECREATION_KEYFRAME_CHECK,Map.of()).strip()).put("execution","auto");
                        check.putObject("strategy").put("approachId","remake").put("method","keyframe-rebuild").put("reason","检查第 "+shot+" 镜的开场画面");
                        check.putArray("dependsOn").add(k.path("stepId").asText());check.putArray("referenceNodeIds");
                        ObjectNode checkSettings=check.putObject("settings").put("operation","check").put("targetStepId",k.path("stepId").asText()).put("compareReferences",true)
                                .put("optionalRank",rank);
                        // 深度复刻的场景图只管人和商品换对没有：动作和构图由动作参考定，「手势和原片这一刻不一样」不该让它重出（2026-11-11 真跑）
                        var ids=checkSettings.putArray("checkIds");KEYFRAME_CHECK_IDS.stream().filter(item->!depth||!"scene-and-action".equals(item)).forEach(ids::add);
                        keyframeSteps.add(checkId);
                    }
                }
            }
            if(depth&&makeKeyframes&&sceneDeps.isEmpty())sceneDeps.addAll(keyframeSteps);
            else if(depth&&u.hasNonNull("sceneStepId"))for(String dep:sceneDeps)if(!keyframeSteps.contains(dep))keyframeSteps.add(dep);
            // 深度复刻：先把这段原片转成动作参考（零积分，StudioDepthVideoService），视频再引用它
            if(depth) {
                ObjectNode control=steps.addObject().put("id","d"+no).put("operation","video-control").put("title","第 "+no+" 段 · 提取动作")
                        .put("prompt","提取原片这一段的动作和镜头运动").put("execution","auto");
                control.putObject("strategy").put("approachId","remake").put("method",videoMethod).put("reason","原片第 "+no+" 段");
                control.putArray("dependsOn");control.putArray("referenceNodeIds");
                control.putObject("settings").put("operation","video-control").putArray("referenceBindings")
                        .addObject().put("nodeId",u.path("clipNodeId").asText()).put("role","clip").put("order",0);
                keyframeSteps.add("d"+no);
            }
            ObjectNode step=steps.addObject().put("id",id).put("operation","video").put("title",text(w.path("title"),u.path("title").asText("第 "+no+" 段"),60))
                    .put("prompt",w.path("prompt").asText().strip()).put("execution","auto");
            step.putObject("strategy").put("approachId","remake").put("method",videoMethod!=null?videoMethod:makeKeyframes?"keyframe-rebuild":"remake-subject").put("reason","原片第 "+no+" 段");
            var depends=step.putArray("dependsOn");keyframeSteps.forEach(depends::add);
            step.putArray("referenceNodeIds");
            ObjectNode settings=step.putObject("settings").put("operation","video").put("model",task.path("model").asText());
            settings.putObject("video").put("mode",task.path("mode").asText()).put("resolutionTier",task.path("tier").asText());
            settings.put("durationSec",u.path("seconds").asInt()).put("aspectRatio",task.path("ratio").asText()).put("count",1);
            var bindings=settings.putArray("referenceBindings");
            for(JsonNode r:u.path("refs")) {
                if(r.hasNonNull("stepId")) {
                    if(!makeKeyframes&&!depth)continue;
                    // 深度复刻：场景图没做出来（没有截图、没给提示词库）时不引用它
                    if(depth&&!r.path("stepId").asText().equals("d"+no)&&!sceneDeps.contains(r.path("stepId").asText()))continue;
                    bindings.addObject().put("stepId",r.path("stepId").asText()).put("role",r.path("role").asText()).put("order",r.path("order").asInt());
                } else bindings.addObject().put("nodeId",r.path("nodeId").asText()).put("role",r.path("role").asText()).put("order",r.path("order").asInt());
            }
            clipOrder.addObject().put("stepId",id);
            // 出片后自动看一遍：替换的人和物有没有当主体出现、原片的动作和看点做出来没有（人或商品没换对自动重出一次，StudioSegmentedRun）
            if(autoCheck){
                ObjectNode check=steps.addObject().put("id","c"+no).put("operation","check").put("title",text(w.path("title"),u.path("title").asText("第 "+no+" 段"),50)+" · 检查")
                        .put("prompt",videoCheck(library,u,makeKeyframes&&!depth))
                        .put("execution","auto");
                check.putObject("strategy").put("approachId","remake").put("method",videoMethod!=null?videoMethod:makeKeyframes?"keyframe-rebuild":"remake-subject").put("reason","检查第 "+no+" 段");
                check.putArray("dependsOn").add(id);check.putArray("referenceNodeIds");
                // 按镜头抽帧，并带上这段交给视频模型的参考图：均匀抽 4 帧又不给素材，「第 3 镜端的是不是炒饭」查不出来
                ObjectNode checkSettings=check.putObject("settings").put("operation","check").put("targetStepId",id).put("sampling","shots").put("compareReferences",true);
                var ids=checkSettings.putArray("checkIds");CHECK_IDS.forEach(ids::add);
            }
            // 字幕：这段生成的秒数内、时间按成片算；越界的截掉，重叠的顺延。
            double offset=u.path("offsetSec").asDouble(),seconds=u.path("seconds").asDouble();
            // 元素替换保留原片画面（原片烧好的字幕也在里面），不再叠一层字幕
            if(!replacement)for(JsonNode c:w.path("captions")) {
                String line=c.path("text").asText("").strip();
                double start=c.path("start").asDouble(Double.NaN),end=c.path("end").asDouble(Double.NaN);
                if(line.isEmpty()||!Double.isFinite(start)||!Double.isFinite(end))continue;
                start=Math.max(0,Math.min(seconds,start))+offset;end=Math.max(0,Math.min(seconds,end))+offset;
                start=Math.max(start,last);
                if(end-start<.3||captions.size()>=60||ORIGINAL_ACCOUNT.matcher(line).find())continue;
                line=line.length()>40?line.substring(0,40):line;
                // 同一句字幕跨段（原片一条字幕挂满全片）：接上一条，不拆成几条一样的
                ObjectNode previous=captions.isEmpty()?null:(ObjectNode)captions.get(captions.size()-1);
                if(previous!=null&&previous.path("text").asText().equals(line)&&start-previous.path("end").asDouble()<=.05)previous.put("end",round(end));
                else captions.addObject().put("start",round(start)).put("end",round(end)).put("text",line);
                last=end;
            }
        }
        // 原片的固定标题放成片顶部（元素替换保留原片画面，标题已经在里面）。拉片没认出来、模型把它写成一条挂满大半条片子的字幕时，也当标题。
        double total=0;
        for(JsonNode u:task.path("units"))total=Math.max(total,u.path("offsetSec").asDouble()+u.path("seconds").asDouble());
        String title=replacement?null:screenTitle(task,captions,total);
        if(clipOrder.size()>1||!captions.isEmpty()||title!=null) {
            ObjectNode assemble=steps.addObject().put("id","final").put("operation","assemble").put("title","合成成片").put("prompt","按原片顺序合成").put("execution","auto");
            // 等每段的视频和检查（含不合格后的重出）都结束再合成
            var waits=assemble.putArray("dependsOn");
            for(JsonNode st:steps)if(!st.path("id").asText().equals("final")&&List.of("video","check").contains(st.path("operation").asText()))waits.add(st.path("id").asText());
            assemble.putArray("referenceNodeIds");
            ObjectNode settings=assemble.putObject("settings").put("operation","assemble").put("audioStrategy","generated");
            settings.set("clipOrder",clipOrder);
            if(!captions.isEmpty())settings.set("captions",captions);
            if(title!=null)settings.put("title",title);
        }
        plan.putArray("questions");
        return plan;
    }

    /** 成片顶部的标题：拉片认出的固定标题；没有时，一句字幕覆盖了整条片子的 80% 以上，就把它从字幕里拿出来当标题。 */
    static String screenTitle(JsonNode task,com.fasterxml.jackson.databind.node.ArrayNode captions,double total) {
        String title=task.path("screenTitle").asText("").strip();
        for(int i=0;i<captions.size();i++) {
            JsonNode c=captions.get(i);
            boolean sameAsTitle=!title.isEmpty()&&title.equals(c.path("text").asText().strip());
            boolean spansFilm=total>0&&c.path("end").asDouble()-c.path("start").asDouble()>=total*.8;
            if(sameAsTitle||title.isEmpty()&&spansFilm) {
                if(title.isEmpty())title=c.path("text").asText().strip();
                captions.remove(i--);
            }
        }
        return title.isEmpty()?null:title;
    }

    /** 检查改好的开场画面时看的几项。 */
    static final List<String> KEYFRAME_CHECK_IDS=List.of("subject-replaced","old-subject-residue","scene-and-action");

    /**
     * 哪些开场画面出完要检查，以及省掉时的先后（名次 1 最后省）。每查一张多一步，步数有上限（{@code task.maxSteps}，技能定的）：
     * 先保证开场画面本身，剩下的步数才给检查，有视觉把戏的镜头优先，其次按镜号。没有记步数上限的（老调用和测试）不检查。
     */
    static Map<String,Integer> keyframeChecks(JsonNode task) {
        int maxSteps=task.path("maxSteps").asInt(0);
        List<JsonNode> all=new ArrayList<>();
        for(JsonNode u:task.path("units"))u.path("keyframes").forEach(all::add);
        // 已经用掉的：每张开场画面一步，每段视频和检查两步，最后合成一步
        int spare=maxSteps-all.size()-task.path("units").size()*2-1;
        if(spare<=0||all.isEmpty())return Map.of();
        all.sort(Comparator.<JsonNode>comparingInt(k->k.path("hasTrick").asBoolean(false)?0:1).thenComparingInt(k->k.path("shot").asInt()));
        Map<String,Integer> out=new HashMap<>();
        int rank=1;
        for(JsonNode k:all.subList(0,Math.min(spare,all.size())))out.put(k.path("stepId").asText(),rank++);
        return out;
    }

    /**
     * 报价放不下时省掉一个可省的检查（{@code settings.optionalRank} 名次最大的那个），连同别的步骤对它的等待。
     * 每个检查按文字模型的最大冻结额报价（Sonnet 约 110 积分，实际用量只有几积分），开场画面的检查全加上，美食那条的报价
     * 就从约 587 涨到约 1433（不含视频），超过页面批准的上限，任务在分析完成后停住（2026-11-10 审查）。
     *
     * @return 省掉的步骤编号；没有可省的返回 null
     */
    public static String dropOptionalCheck(ObjectNode plan) {
        ArrayNode steps=(ArrayNode)plan.path("steps");
        int victim=-1,worst=0;
        for(int i=0;i<steps.size();i++) {
            JsonNode s=steps.get(i);
            int rank=s.path("settings").path("optionalRank").asInt(0);
            if("check".equals(s.path("operation").asText())&&rank>worst){worst=rank;victim=i;}
        }
        if(victim<0)return null;
        String id=steps.get(victim).path("id").asText();
        steps.remove(victim);
        for(JsonNode s:steps) {
            if(!(s.path("dependsOn") instanceof ArrayNode deps))continue;
            for(int i=deps.size()-1;i>=0;i--)if(id.equals(deps.get(i).asText()))deps.remove(i);
        }
        return id;
    }

    /**
     * 每段成片的检查要点（提示词库 stage-recreation-video-check）：按这段的镜头和参考图写成逐镜的是非题，不写笼统的「有没有做出来」。
     * suggestion 要求写成「第N镜：这一镜应该是什么画面」：不合格重出时这些句子会接到视频提示词后面（StudioSegmentedRun），
     * 提示词可能原样交给视频模型，所以只能是画面描述，不能是写给系统的话。
     */
    static String videoCheck(Texts library,JsonNode unit,boolean keyframes) {
        List<Map<String,Object>> shots=new ArrayList<>();
        if(keyframes)for(JsonNode k:unit.path("keyframes"))
            shots.add(Map.of("shot",k.path("shot").asInt(),"at",StudioVideoBreakdown.fmt(k.path("atSec").asDouble()),"label",k.path("label").asText()));
        Map<String,Object> vars=new LinkedHashMap<>();
        vars.put("hasRefs",unit.path("refs").size()>0);vars.put("keyframes",shots);
        vars.put("sameFrames",keyframes?sameFrames(unit):List.of());
        // 每张参考图是什么（开场画面 / 哪份替换素材）：只给编号时，检查模型对不上「替换素材 1」是图几，把换对了的菜也判成没换
        // （2026-11-10 美食那条真跑：图9 就是替换素材 1，它说「未提供替换素材 1、2、3」）
        List<Map<String,Object>> refs=new ArrayList<>();
        for(JsonNode r:unit.path("refs")) {
            if(r.hasNonNull("stepId")&&!keyframes&&!unit.has("sceneStepId"))continue;
            // 检查只对照图：声音和参考视频（深度图、原片片段）不交给检查模型
            if(!Set.of("reference-audio","reference-video").contains(r.path("role").asText()))refs.add(Map.of("label",r.path("label").asText(),"what",r.path("what").asText("")));
        }
        vars.put("refs",refs);
        return library.render(com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints.RECREATION_VIDEO_CHECK,vars).strip();
    }

    /** 一段里重复用的画面，给提示词库的变量：{@code [{shot, at（这段里约第几秒）, of（是哪一镜的开场）, label（图N）}]}。 */
    static List<Map<String,Object>> sameFrames(JsonNode unit) {
        List<Map<String,Object>> out=new ArrayList<>();
        for(JsonNode s:unit.path("sameFrames"))out.add(Map.of("shot",s.path("shot").asInt(),"at",StudioVideoBreakdown.fmt(s.path("atSec").asDouble()),
                "of",s.path("of").asInt(),"label",s.path("label").asText()));
        return out;
    }

    /** 写提示词的模型按名称点的素材（「」、空格、大小写不计），只认这次的素材，重复的只算一次。 */
    static List<JsonNode> materialsNamed(JsonNode task,JsonNode names) {
        List<JsonNode> out=new ArrayList<>();
        if(names==null||!names.isArray())return out;
        Set<String> seen=new HashSet<>();
        for(JsonNode n:names) {
            String wanted=normalizeName(n.asText(""));
            if(wanted.isEmpty())continue;
            for(JsonNode m:task.path("materials")) {
                if("声音".equals(m.path("slot").asText()))continue;
                if(normalizeName(m.path("title").asText("")).equals(wanted)&&seen.add(m.path("nodeId").asText()))out.add(m);
            }
        }
        return out;
    }
    private static String normalizeName(String v){return v.replaceAll("[「」『』\"“”\\s]","").toLowerCase(Locale.ROOT);}

    /** 有参考的模式优先（全能参考）；没有就用不需要首尾帧的模式，只按文字出片。 */
    public static VideoStudioModeSpec mode(VideoStudioContract contract,boolean hasMaterials) {
        if(!hasMaterials)for(var m:contract.modes())if(m.references()==null&&!m.needsFirstFrame()&&!m.needsLastFrame())return m;
        for(var m:contract.modes())if(m.references()!=null&&!m.needsFirstFrame()&&!m.needsLastFrame())return m;
        for(var m:contract.modes())if(!m.needsFirstFrame()&&!m.needsLastFrame())return m;
        throw unavailable("所选视频模型只能按首帧出片，做不了复刻，请换一个支持参考素材的模型");
    }

    private static String slotLabel(String slot) {
        return switch(slot==null?"image":slot){case "character" -> "出镜人物";case "voice" -> "声音";default -> "替换素材";};
    }
    private static ArrayNode strings(JsonNode array) {
        ArrayNode out=OM.createArrayNode();
        if(array.isArray())for(JsonNode v:array)if(v.isTextual()&&!v.asText().isBlank()&&out.size()<12)out.add(v.asText().length()>500?v.asText().substring(0,500):v.asText());
        return out;
    }
    private static String text(JsonNode value,String fallback,int max) {
        String v=value!=null&&value.isTextual()&&!value.asText().isBlank()?value.asText().strip():fallback;
        return v.length()>max?v.substring(0,max):v;
    }
    private static boolean blank(String v){return v==null||v.isBlank();}
    private static double round(double v){return Math.round(v*100)/100.0;}
    private static BusinessException unavailable(String text){return BusinessException.badRequest("STUDIO_VIDEO_MODE_UNAVAILABLE",text);}
}
