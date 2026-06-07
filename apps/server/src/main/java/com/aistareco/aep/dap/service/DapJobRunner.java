package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapDerivative;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.model.DapLook;
import com.aistareco.aep.dap.model.DapPhoto;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapDerivativeRepository;
import com.aistareco.aep.dap.repository.DapJobRepository;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 异步作业执行器 —— 所有 AI 生成在 dapJobExecutor 线程上跑：
 * 形象生成（4 变体）/ 真人复刻 / 自然语言迭代 / 几何精调 / 造型设计 / 六类衍生（含云端视频）。
 *
 * 降级策略：未在后台「AI 应用绑定」给 DAP_* 用途绑定端点时，产出本地占位产物并把 avatar.mock=true
 * （前端 MOCK 角标），链路不阻断；视频占位依赖本机 ffmpeg，没有则任务失败并明确提示。
 */
@Service
public class DapJobRunner {

    private static final Logger log = LoggerFactory.getLogger(DapJobRunner.class);

    private final DapJobRepository jobRepo;
    private final DapAvatarRepository avatarRepo;
    private final DapDerivativeRepository derivRepo;
    private final DapLookRepository lookRepo;
    private final DapCaptureRepository captureRepo;
    private final DapAvatarService avatarService;
    private final DapCatalogService catalog;
    private final DapMultimodalClient multimodal;
    private final FileStorageService storage;
    private final CreditService creditService;
    private final DapSupport support;
    private final PromptService prompts;

    public DapJobRunner(DapJobRepository jobRepo,
                        DapAvatarRepository avatarRepo,
                        DapDerivativeRepository derivRepo,
                        DapLookRepository lookRepo,
                        DapCaptureRepository captureRepo,
                        DapAvatarService avatarService,
                        DapCatalogService catalog,
                        DapMultimodalClient multimodal,
                        FileStorageService storage,
                        CreditService creditService,
                        DapSupport support,
                        PromptService prompts) {
        this.jobRepo = jobRepo;
        this.avatarRepo = avatarRepo;
        this.derivRepo = derivRepo;
        this.lookRepo = lookRepo;
        this.captureRepo = captureRepo;
        this.avatarService = avatarService;
        this.catalog = catalog;
        this.multimodal = multimodal;
        this.storage = storage;
        this.creditService = creditService;
        this.support = support;
        this.prompts = prompts;
    }

    // ── prompt 解析（admin「Prompt 管理」可改；resource .md 兜底）───────────────

    /** 取 promptKey 的 user 模板并填充占位符。 */
    private String promptOf(String promptKey, Map<String, String> vars) {
        PromptService.ResolvedPrompt p = prompts.resolve(promptKey);
        return PromptService.fill(p.userTemplate(), vars == null ? Map.of() : vars);
    }

    /** 取 promptKey 的 system 提示词。 */
    private String systemOf(String promptKey) {
        return prompts.resolve(promptKey).system();
    }

    @Async("dapJobExecutor")
    public void run(String jobId) {
        DapJob job = jobRepo.findById(jobId).orElse(null);
        if (job == null) return;
        job.setStartedAt(Instant.now());
        job.setStatus("running");
        job.setStage("runner.start");
        job.setStageUpdatedAt(Instant.now());
        jobRepo.save(job);
        long startNanos = System.nanoTime();
        log.info("[dap-job] run start id={} type={} mode={} engine={} owner={} avatar={}",
                job.getId(), job.getType(), job.getMode(), job.getEngine(), job.getOwnerUserId(), job.getAvatarId());
        try {
            switch (job.getType()) {
                case DapJob.T_GENERATE -> runGenerate(job);
                case DapJob.T_GENERATE_UPLOAD -> runGenerateUpload(job);
                case DapJob.T_ITERATE -> runIterate(job);
                case DapJob.T_WARP -> runWarp(job);
                case DapJob.T_LOOK -> runLook(job);
                case DapJob.T_DERIVE -> runDerive(job);
                default -> throw new IllegalStateException("未知任务类型 " + job.getType());
            }
            commitCredits(job);
            finish(job, "已完成");
            log.info("[dap-job] run ok id={} type={} durationMs={} resultKeys={}",
                    job.getId(), job.getType(), elapsedMs(startNanos),
                    job.getResult() == null ? 0 : job.getResult().size());
        } catch (CancelledException ce) {
            releaseCredits(job, "用户取消");
            fail(job, "已取消", null);
            log.info("[dap-job] run canceled id={} type={} durationMs={}",
                    job.getId(), job.getType(), elapsedMs(startNanos));
        } catch (DapMultimodalClient.DapModelException ae) {
            log.warn("[dap-job] run model-error id={} type={} code={} durationMs={} msg={}",
                    job.getId(), job.getType(), ae.getCode(), elapsedMs(startNanos), ae.getMessage());
            releaseCredits(job, "生成失败");
            fail(job, "生成失败", ae.getCode() + ": " + ae.getMessage());
        } catch (Exception e) {
            log.error("[dap-job] run failed id={} type={} durationMs={}",
                    job.getId(), job.getType(), elapsedMs(startNanos), e);
            releaseCredits(job, "生成失败");
            fail(job, "生成失败", e.getMessage());
        }
    }

    // ── 各类型执行 ────────────────────────────────────────────

    /** AI 描述 → 人设解析（chat）→ 4 版候选形象（image）。 */
    private void runGenerate(DapJob job) {
        DapAvatar a = avatar(job);
        Map<String, Object> form = subMap(job.getPayload(), "form");
        String desc = str(form, "desc", "");
        String style = str(form, "style", "写实");

        progress(job, 6, "persona.chat", "解析人设…");
        String imagePrompt;
        if (multimodal.isConfigured()) {
            JsonNode persona = multimodal.chatJson(systemOf(PromptService.KEY_DAP_PERSONA),
                    promptOf(PromptService.KEY_DAP_PERSONA, personaVars(form)));
            applyPersona(a, persona, desc);
            imagePrompt = persona.path("imagePromptEn").asText(null);
            if (imagePrompt == null || imagePrompt.isBlank()) {
                imagePrompt = "portrait of an original virtual character, " + style + " style";
            }
        } else {
            applyPersonaFallback(a, form);
            imagePrompt = "portrait placeholder";
        }
        a.setBasePrompt(imagePrompt);
        a.setDescPrompt(desc);
        checkCancel(job);

        progress(job, 18, "image.generate.1", "生成候选 1/4…");
        String[] variantHints = {
                "front-facing portrait, looking directly at camera",
                "three-quarter view, gentle smile",
                "side profile view, elegant posture",
                "looking back over the shoulder, candid feel"};
        List<String> keys = new ArrayList<>();
        long bytesTotal = 0;
        for (int i = 0; i < 4; i++) {
            byte[] img;
            if (multimodal.isConfigured()) {
                img = multimodal.generateImage(promptOf(PromptService.KEY_DAP_IMAGE_GENERATE,
                        Map.of("imagePrompt", imagePrompt, "variantHint", variantHints[i])), "768x1024", null);
            } else {
                img = support.placeholderPortrait(a.getHue() + i * 16, "占位 · v" + (i + 1), 768, 1024);
            }
            FileStorageService.StoredFile stored = storage.store(img, "dap/avatar", job.getOwnerUserId(), "png", "image/png");
            keys.add(stored.key());
            bytesTotal += stored.bytes();
            progress(job, 18 + (i + 1) * 19, i < 3 ? "image.generate." + (i + 2) : "image.finalize",
                    i < 3 ? "生成候选 " + (i + 2) + "/4…" : "整理候选…");
            checkCancel(job);
        }
        a.setVariantKeys(keys);
        a.setMock(!multimodal.isConfigured());
        a.setEngine(multimodal.isConfigured() ? "云端图像引擎" : "占位引擎");
        a.setImageBytes(a.getImageBytes() + bytesTotal);
        a.setStatus("proofing");
        avatarService.save(a);
        job.setResult(Map.of("variants", keys.size()));
    }

    /** 照片 / 捕获素材 → 高保真复刻 1 张。 */
    private void runGenerateUpload(DapJob job) {
        DapAvatar a = avatar(job);
        progress(job, 10, "inputs.collect", "读取素材…");
        List<String> inputs = collectIdentityInputs(job, a);

        progress(job, 30, "image.restore", "复刻形象…");
        byte[] img;
        if (multimodal.isConfigured() && !inputs.isEmpty()) {
            img = multimodal.generateImage(promptOf(PromptService.KEY_DAP_IMAGE_CLONE, null), "768x1024", inputs);
        } else if (multimodal.isConfigured()) {
            // 没有可用素材时退化为文生图（不应发生：controller 已校验）
            img = multimodal.generateImage("photorealistic half-body portrait of a person, studio lighting", "768x1024", null);
        } else {
            img = support.placeholderPortrait(a.getHue(), "占位 · 复刻", 768, 1024);
        }
        checkCancel(job);
        progress(job, 80, "storage.persist", "落库…");
        FileStorageService.StoredFile stored = storage.store(img, "dap/avatar", job.getOwnerUserId(), "png", "image/png");
        a.setImageKey(stored.key());
        a.setMock(!multimodal.isConfigured());
        a.setImageBytes(a.getImageBytes() + stored.bytes());
        a.setStatus("pending");
        avatarService.addVersionAt(a, 1, "真人复刻生成", "init", stored.key());
        avatarService.save(a);
        job.setResult(Map.of("imageUrl", storage.signedUrl(stored.key())));
    }

    /** 自然语言迭代（i2i 编辑当前定妆图）。 */
    private void runIterate(DapJob job) {
        DapAvatar a = avatar(job);
        String instruction = str(job.getPayload(), "instruction", "");
        progress(job, 12, "instruction.translate", "理解修改意图…");

        byte[] img;
        if (multimodal.isConfigured()) {
            String en = cleanEditPhrase(multimodal.chat(systemOf(PromptService.KEY_DAP_TRANSLATE_EDIT),
                    promptOf(PromptService.KEY_DAP_TRANSLATE_EDIT, Map.of("input", instruction))));
            checkCancel(job);
            progress(job, 35, "image.edit", "重绘形象…");
            img = multimodal.generateImage(promptOf(PromptService.KEY_DAP_IMAGE_ITERATE,
                    Map.of("instruction", en)), "768x1024", identityInputOf(a));
        } else {
            img = support.placeholderPortrait(a.getHue() + a.getVersions() * 7, "占位 · 迭代", 768, 1024);
        }
        checkCancel(job);
        progress(job, 85, "storage.persist", "落库…");
        FileStorageService.StoredFile stored = storage.store(img, "dap/avatar", job.getOwnerUserId(), "png", "image/png");
        a.setImageKey(stored.key());
        a.setImageBytes(a.getImageBytes() + stored.bytes());
        if (!"refining".equals(a.getStatus())) a.setStatus("iterating");
        avatarService.addVersion(a, instruction, "iterate", stored.key());
        avatarService.save(a);
        job.setResult(Map.of("imageUrl", storage.signedUrl(stored.key())));
    }

    /** 几何精调（参数 → 编辑指令 → i2i）。 */
    private void runWarp(DapJob job) {
        DapAvatar a = avatar(job);
        Map<String, Object> params = subMap(job.getPayload(), "params");
        progress(job, 15, "warp.prepare", "应用精调参数…");

        StringBuilder zh = new StringBuilder("精调 ·");
        StringBuilder en = new StringBuilder();
        Map<String, String[]> dims = Map.of(
                "face", new String[]{"脸型", "face shape / jawline width"},
                "eye", new String[]{"眼睛", "eye size"},
                "nose", new String[]{"鼻梁", "nose bridge height"},
                "mouth", new String[]{"嘴型", "mouth width"},
                "chin", new String[]{"下巴", "chin length"});
        boolean any = false;
        for (Map.Entry<String, String[]> e : dims.entrySet()) {
            Object v = params.get(e.getKey());
            if (v == null) continue;
            int val = (int) Double.parseDouble(String.valueOf(v));
            if (val == 0) continue;
            any = true;
            zh.append(' ').append(e.getValue()[0]).append(val > 0 ? " +" : " ").append(val).append(" /");
            en.append(val > 0 ? "slightly increase " : "slightly decrease ")
                    .append(e.getValue()[1]).append(" by ").append(Math.abs(val)).append("%, ");
        }
        String note = any ? zh.substring(0, zh.length() - 2) : "精调 · 无参数变化";

        byte[] img;
        if (multimodal.isConfigured() && any) {
            progress(job, 40, "image.edit", "重绘形象…");
            img = multimodal.generateImage(promptOf(PromptService.KEY_DAP_IMAGE_WARP,
                    Map.of("adjustments", en.toString())), "768x1024", identityInputOf(a));
        } else if (!multimodal.isConfigured()) {
            img = support.placeholderPortrait(a.getHue() + 3, "占位 · 精调", 768, 1024);
        } else {
            job.setResult(Map.of("skipped", true));
            return; // 无参数变化 → 不动图
        }
        checkCancel(job);
        progress(job, 85, "storage.persist", "落库…");
        FileStorageService.StoredFile stored = storage.store(img, "dap/avatar", job.getOwnerUserId(), "png", "image/png");
        a.setImageKey(stored.key());
        a.setImageBytes(a.getImageBytes() + stored.bytes());
        a.setStatus("refining");
        avatarService.addVersion(a, note, "refine", stored.key());
        avatarService.save(a);
        job.setResult(Map.of("imageUrl", storage.signedUrl(stored.key())));
    }

    /** 设计造型 / 场景替换 → 新 Look。 */
    private void runLook(DapJob job) {
        DapAvatar a = avatar(job);
        String lookId = str(job.getPayload(), "lookId", null);
        DapLook look = lookId != null ? lookRepo.findById(lookId).orElse(null) : null;
        if (look == null) throw new IllegalStateException("look 记录缺失");

        progress(job, 15, "look.plan", "构思造型…");
        String scenePrompt = catalog.scenePromptEn(look.getSceneId());
        String userPrompt = look.getPrompt();
        String en;
        if (scenePrompt != null) {
            en = scenePrompt;
        } else if (multimodal.isConfigured() && userPrompt != null && !userPrompt.isBlank()) {
            en = cleanEditPhrase(multimodal.chat(systemOf(PromptService.KEY_DAP_TRANSLATE_EDIT),
                    promptOf(PromptService.KEY_DAP_TRANSLATE_EDIT, Map.of("input", userPrompt))));
        } else {
            en = userPrompt == null ? "new outfit and scene" : userPrompt;
        }
        checkCancel(job);
        progress(job, 45, "image.look", "生成造型…");
        byte[] img;
        if (multimodal.isConfigured()) {
            img = multimodal.generateImage(promptOf(PromptService.KEY_DAP_IMAGE_LOOK,
                    Map.of("style", en)), "768x1024", identityInputOf(a));
        } else {
            img = support.placeholderPortrait(a.getHue() + 24, "占位 · 造型", 768, 1024);
        }
        progress(job, 85, "storage.persist", "落库…");
        FileStorageService.StoredFile stored = storage.store(img, "dap/look", job.getOwnerUserId(), "png", "image/png");
        look.setImageKey(stored.key());
        look.setBytes(stored.bytes());
        look.setStatus("done");
        lookRepo.save(look);
        avatarService.save(a);
        job.setResult(Map.of("lookId", look.getId(), "imageUrl", storage.signedUrl(stored.key())));
    }

    /** 各类型自定义条目的默认出图尺寸。 */
    private static String defaultSizeOf(String key) {
        return "expr".equals(key) ? "1024x1024" : "768x1024";
    }

    /** 六类衍生。payload: derivKey, prevStatus, templateId?, options?{items, extraPrompt, motion} */
    private void runDerive(DapJob job) {
        DapAvatar a = avatar(job);
        String key = str(job.getPayload(), "derivKey", "atlas");
        String prevStatus = str(job.getPayload(), "prevStatus", a.getStatus());
        Map<String, Object> options = subMap(job.getPayload(), "options");
        String extraEn = resolveExtraPrompt(job, options);              // 补充约束（已翻译，可空串）
        List<String[]> custom = parseCustomItems(options, defaultSizeOf(key)); // 自定义条目（null=默认配方）
        try {
            switch (key) {
                case "atlas" -> deriveAtlas(job, a, extraEn);
                case "expr" -> deriveImageSet(job, a, "expr", "image/png",
                        custom != null ? custom : List.of(
                        new String[]{"微笑", "bright warm smile expression", "1024x1024"},
                        new String[]{"严肃", "serious focused expression", "1024x1024"},
                        new String[]{"惊喜", "surprised delighted expression", "1024x1024"},
                        new String[]{"沉思", "thoughtful calm expression", "1024x1024"}),
                        "表情差分 · 同一身份", extraEn);
                case "scene" -> deriveImageSet(job, a, "scene", "image/png",
                        custom != null ? custom : List.of(
                        new String[]{"书架暖光", catalog.scenePromptEn("s2"), "768x1024"},
                        new String[]{"咖啡馆", catalog.scenePromptEn("s6"), "768x1024"}),
                        "剧情场景 · 置入环境", extraEn);
                case "ward" -> deriveImageSet(job, a, "ward", "image/png",
                        custom != null ? custom : List.of(
                        new String[]{"商务正装", "wearing an elegant tailored business suit", "768x1024"},
                        new String[]{"街头潮流", "wearing trendy streetwear, casual style", "768x1024"}),
                        "换装变体 · 沿用同脸", extraEn);
                case "d3" -> deriveImageSet(job, a, "d3", "image/png", List.of(
                        new String[]{"正面视图", "full-body 3d character turntable render, front view, neutral pose, studio background", "768x1024"},
                        new String[]{"侧面视图", "full-body 3d character turntable render, side view, neutral pose, studio background", "768x1024"},
                        new String[]{"背面视图", "full-body 3d character turntable render, back view, neutral pose, studio background", "768x1024"},
                        new String[]{"四分之三", "full-body 3d character turntable render, three-quarter view, neutral pose, studio background", "768x1024"}),
                        "多角度 3D 预览 · GLB 导出排期中", extraEn);
                case "video" -> deriveVideo(job, a, options, extraEn);
                default -> throw new IllegalStateException("未知衍生类型 " + key);
            }
            Map<String, Object> deriv = a.derivOrEmpty();
            deriv.put(key, "done");
            a.setDeriv(deriv);
            a.setStatus("archived".equals(prevStatus) || "finalized".equals(prevStatus) ? prevStatus : a.getStatus());
            avatarService.save(a);
        } catch (RuntimeException e) {
            // 回滚衍生状态标记
            Map<String, Object> deriv = a.derivOrEmpty();
            Object cnt = a.countsOrEmpty().getOrDefault(key, 0);
            deriv.put(key, (cnt instanceof Number n && n.intValue() > 0) ? "done" : "empty");
            a.setDeriv(deriv);
            a.setStatus(prevStatus);
            avatarService.save(a);
            throw e;
        }
    }

    /** 标准图集（5 张固定机位），同时回填 avatar.shotKeys。 */
    private void deriveAtlas(DapJob job, DapAvatar a, String extraEn) {
        String tplPrompt = catalog.templatePromptEn(str(job.getPayload(), "templateId", a.getTemplateId()));
        List<String[]> shots = List.of(
                new String[]{"front-half", "正面半身", "front-facing half-body shot", "768x1024"},
                new String[]{"front-full", "正面全身", "front-facing full-body shot, head to toe", "768x1365"},
                new String[]{"left", "左侧脸", "left side profile portrait", "768x1024"},
                new String[]{"right", "右侧脸", "right side profile portrait", "768x1024"},
                new String[]{"expr", "表情集", "close-up portrait with a bright smile", "1024x1024"});

        derivRepo.deleteByAvatarIdAndDerivKey(a.getId(), "atlas");
        Map<String, Object> shotKeys = new LinkedHashMap<>();
        long bytes = 0;
        int i = 0;
        for (String[] s : shots) {
            checkCancel(job);
            progress(job, 10 + i * 17, "atlas.image." + (i + 1), "出图 " + s[1] + "（" + (i + 1) + "/5）…");
            byte[] img;
            if (multimodal.isConfigured()) {
                String prompt = promptOf(PromptService.KEY_DAP_IMAGE_ATLAS, Map.of(
                        "shot", s[2] + (extraEn.isBlank() ? "" : ", " + extraEn),
                        "template", tplPrompt != null ? ". " + tplPrompt : ""));
                img = multimodal.generateImage(prompt, s[3], identityInputOf(a));
            } else {
                img = support.placeholderPortrait(a.getHue() + i * 9, "占位 · " + s[1], 768, 1024);
            }
            FileStorageService.StoredFile stored = storage.store(img, "dap/atlas", job.getOwnerUserId(), "png", "image/png");
            derivRepo.save(DapDerivative.builder()
                    .id(newDerivId())
                    .avatarId(a.getId())
                    .ownerUserId(job.getOwnerUserId())
                    .derivKey("atlas").idx(i).kind("image")
                    .fileKey(stored.key())
                    .label(s[1]).spec(s[3].replace("x", "×") + " · PNG")
                    .jobId(job.getId())
                    .bytes(stored.bytes())
                    .createdAt(Instant.now())
                    .build());
            shotKeys.put(s[0], stored.key());
            bytes += stored.bytes();
            i++;
        }
        a.setShotKeys(shotKeys);
        a.setImageBytes(a.getImageBytes() + bytes);
        Map<String, Object> counts = a.countsOrEmpty();
        counts.put("atlas", shots.size());
        a.setCounts(counts);
        job.setResult(Map.of("count", shots.size()));
    }

    /** 通用图组衍生（expr / scene / ward / d3）。items: [label, promptEn, size]；extraEn 追加到每张图。 */
    private void deriveImageSet(DapJob job, DapAvatar a, String key, String mime,
                                List<String[]> items, String specNote, String extraEn) {
        derivRepo.deleteByAvatarIdAndDerivKey(a.getId(), key);
        int i = 0;
        for (String[] it : items) {
            checkCancel(job);
            progress(job, 10 + i * (80 / Math.max(1, items.size())), key + ".image." + (i + 1),
                    it[0] + "（" + (i + 1) + "/" + items.size() + "）…");
            byte[] img;
            if (multimodal.isConfigured()) {
                img = multimodal.generateImage(promptOf(PromptService.KEY_DAP_IMAGE_DERIV,
                        Map.of("item", it[1] + (extraEn.isBlank() ? "" : ", " + extraEn))), it[2], identityInputOf(a));
            } else {
                img = support.placeholderPortrait(a.getHue() + i * 13, "占位 · " + it[0], 768, 1024);
            }
            FileStorageService.StoredFile stored = storage.store(img, "dap/" + key, job.getOwnerUserId(), "png", "image/png");
            derivRepo.save(DapDerivative.builder()
                    .id(newDerivId())
                    .avatarId(a.getId())
                    .ownerUserId(job.getOwnerUserId())
                    .derivKey(key).idx(i)
                    .kind("d3".equals(key) ? "model3d" : "image")
                    .fileKey(stored.key())
                    .label(it[0])
                    .spec("d3".equals(key) ? specNote : it[2].replace("x", "×") + " · PNG")
                    .jobId(job.getId())
                    .bytes(stored.bytes())
                    .createdAt(Instant.now())
                    .build());
            i++;
        }
        Map<String, Object> counts = a.countsOrEmpty();
        counts.put(key, "d3".equals(key) ? 1 : items.size());
        a.setCounts(counts);
        job.setResult(Map.of("count", items.size()));
    }

    /** 运镜方式 → 英文视频 prompt（orbit 走可配置的 dap.video_orbit 模板）。 */
    private String videoPromptFor(String motion, String extraEn) {
        String base = switch (motion == null ? "orbit" : motion) {
            case "push_in" -> "Slow cinematic push-in towards this person, subtle natural motion, studio lighting, high quality, no scene change";
            case "pull_back" -> "Slow cinematic pull-back revealing this person, subtle natural motion, studio lighting, high quality, no scene change";
            case "pan" -> "Slow cinematic left-to-right pan across this person, subtle natural motion, studio lighting, high quality, no scene change";
            default -> promptOf(PromptService.KEY_DAP_VIDEO_ORBIT, null);
        };
        return base + (extraEn.isBlank() ? "" : ", " + extraEn);
    }

    /** 运镜短视频（Agnes 异步视频 → 下载落库）。云端 status/progress 实时回显到任务卡。 */
    private void deriveVideo(DapJob job, DapAvatar a, Map<String, Object> options, String extraEn) {
        progress(job, 8, "video.submit", "提交视频任务…");
        byte[] mp4;
        String spec;
        if (multimodal.isConfigured()) {
            String motion = str(options, "motion", "orbit");
            String taskId = multimodal.createVideoTask(
                    videoPromptFor(motion, extraEn),
                    firstOrNull(identityInputOf(a)), 768, 1152, 121, 24);
            progress(job, 14, "video.queued", "已提交 · 云端排队中…");
            DapMultimodalClient.VideoTask t = multimodal.awaitVideo(taskId, vt -> {
                // 回显云端真实状态：queued → 排队中；in_progress + progress → 真实百分比
                int cloudPct = vt.progress() == null ? -1 : Math.max(0, Math.min(100, vt.progress()));
                if ("queued".equals(vt.status())) {
                    progress(job, 16, "video.queued", "云端排队中…");
                } else if (cloudPct >= 0) {
                    progress(job, 18 + (int) (cloudPct * 0.65), "video.rendering", "云端渲染中 · " + cloudPct + "%");
                } else {
                    progress(job, Math.max(job.getPct(), 18), "video.rendering", "云端渲染中…");
                }
                checkCancelQuiet(job);
            });
            if (!"completed".equals(t.status()) || t.videoUrl() == null) {
                throw new DapMultimodalClient.DapModelException("DAP_MODEL_VIDEO_FAILED",
                        "视频任务未成功：status=" + t.status());
            }
            progress(job, 88, "video.download", "下载成片…");
            mp4 = multimodal.download(t.videoUrl(), 512L * 1024 * 1024);
            spec = "768×1152 · 5s · MP4";
        } else {
            mp4 = placeholderVideo(a);
            spec = "占位视频 · MP4";
        }
        checkCancel(job);
        progress(job, 94, "storage.persist", "落库…");
        FileStorageService.StoredFile stored = storage.store(mp4, "dap/video", job.getOwnerUserId(), "mp4", "video/mp4");
        int idx = derivRepo.findByAvatarIdAndDerivKeyOrderByIdxAsc(a.getId(), "video").size();
        derivRepo.save(DapDerivative.builder()
                .id(newDerivId())
                .avatarId(a.getId())
                .ownerUserId(job.getOwnerUserId())
                .derivKey("video").idx(idx).kind("video")
                .fileKey(stored.key())
                .thumbKey(a.getImageKey())
                .label("环绕运镜 · " + (idx + 1))
                .spec(spec)
                .jobId(job.getId())
                .bytes(stored.bytes())
                .createdAt(Instant.now())
                .build());
        Map<String, Object> counts = a.countsOrEmpty();
        counts.put("video", idx + 1);
        a.setCounts(counts);
        job.setResult(Map.of("videoUrl", storage.signedUrl(stored.key())));
    }

    // ── 衍生自定义配方（options：items / extraPrompt / motion）──

    /** 补充约束：中文自动翻译成英文短语；空 → ""。 */
    private String resolveExtraPrompt(DapJob job, Map<String, Object> options) {
        String raw = str(options, "extraPrompt", null);
        if (raw == null || raw.isBlank()) return "";
        String en = toEnglishPhrase(raw.trim());
        log.info("[dap-job] derive extraPrompt id={} raw={} en={}", job.getId(),
                raw.length() > 80 ? raw.substring(0, 80) + "…" : raw,
                en.length() > 120 ? en.substring(0, 120) + "…" : en);
        return en;
    }

    /** options.items: [{label, prompt}] → [label, promptEn, size]；≤6 条；无有效条目返回 null（用默认配方）。 */
    private List<String[]> parseCustomItems(Map<String, Object> options, String size) {
        Object v = options == null ? null : options.get("items");
        if (!(v instanceof List<?> list) || list.isEmpty()) return null;
        List<String[]> out = new ArrayList<>();
        int n = 1;
        for (Object o : list) {
            if (out.size() >= 6) break;
            if (!(o instanceof Map<?, ?> m)) continue;
            Object p = m.get("prompt");
            String prompt = p == null ? null : String.valueOf(p).trim();
            if (prompt == null || prompt.isBlank()) continue;
            Object l = m.get("label");
            String label = l == null || String.valueOf(l).isBlank() ? "自定义 " + n : String.valueOf(l).trim();
            out.add(new String[]{label, toEnglishPhrase(prompt), size});
            n++;
        }
        return out.isEmpty() ? null : out;
    }

    /** 含中文且引擎可用 → 经翻译链转英文图像描述；否则原样（清洗引号/尾句号）。 */
    private String toEnglishPhrase(String s) {
        if (s == null || s.isBlank()) return "";
        boolean hasCjk = s.codePoints().anyMatch(c -> c >= 0x4E00 && c <= 0x9FFF);
        if (hasCjk && multimodal.isConfigured()) {
            try {
                return cleanEditPhrase(multimodal.chat(systemOf(PromptService.KEY_DAP_TRANSLATE_EDIT),
                        promptOf(PromptService.KEY_DAP_TRANSLATE_EDIT, Map.of("input", s))));
            } catch (Exception e) {
                log.warn("[dap-job] extraPrompt translate failed, use raw: {}", e.getMessage());
            }
        }
        return cleanEditPhrase(s);
    }

    // ── 身份输入（i2i 源图）────────────────────────────────────

    /** 当前定妆图 → i2i 输入（OSS 公网 URL 直接给；本地文件转 dataURI）。 */
    private List<String> identityInputOf(DapAvatar a) {
        if (a.getImageKey() == null) return List.of();
        String input = toAgnesImageInput(a.getImageKey());
        return input == null ? List.of() : List.of(input);
    }

    /** 复刻输入：优先照片（≤3 张），其次捕获关键帧 / 素材帧。 */
    private List<String> collectIdentityInputs(DapJob job, DapAvatar a) {
        List<String> inputs = new ArrayList<>();
        List<DapPhoto> photos = avatarService.photosOf(a.getId());
        for (DapPhoto p : photos) {
            if (inputs.size() >= 3) break;
            String in = toAgnesImageInput(p.getFileKey());
            if (in != null) inputs.add(in);
        }
        if (inputs.isEmpty()) {
            String captureId = str(job.getPayload(), "captureId", null);
            DapCapture cap = captureId != null
                    ? captureRepo.findById(captureId).orElse(null)
                    : captureRepo.findFirstByAvatarIdAndOwnerUserIdOrderByCreatedAtDesc(a.getId(), job.getOwnerUserId()).orElse(null);
            if (cap != null && cap.getFrameKey() != null) {
                String in = toAgnesImageInput(cap.getFrameKey());
                if (in != null) inputs.add(in);
            }
        }
        return inputs;
    }

    /** dataURI 输入超过该字节数时先压缩（缓解大请求体导致的 EOF/超时）。 */
    private static final int DATAURI_COMPRESS_THRESHOLD_BYTES = 300 * 1024;
    private static final int DATAURI_MAX_WIDTH = 768;

    /** storage key → Agnes 可消费的图片输入（公网 URL 或 dataURI；大图自动压缩）。 */
    private String toAgnesImageInput(String key) {
        String url = storage.signedUrl(key);
        boolean publicUrl = url != null && (url.startsWith("http://") || url.startsWith("https://"))
                && !url.contains("//localhost") && !url.contains("//127.0.0.1") && !url.contains("//0.0.0.0");
        if (publicUrl) {
            return url; // OSS / CDN 公网可达；localhost（本地 fake-CDN）对 Agnes 云端不可达 → 走下方 dataURI
        }
        try {
            Path p = storage.openForRead(key);
            byte[] bytes = Files.readAllBytes(p);
            String mime = key.endsWith(".jpg") || key.endsWith(".jpeg") ? "image/jpeg"
                    : key.endsWith(".webp") ? "image/webp" : "image/png";
            if (bytes.length > DATAURI_COMPRESS_THRESHOLD_BYTES) {
                byte[] compressed = compressToJpeg(bytes, DATAURI_MAX_WIDTH);
                if (compressed != null && compressed.length < bytes.length) {
                    log.info("[dap] 身份图压缩 key={} {}B → {}B（dataURI 上行）", key, bytes.length, compressed.length);
                    bytes = compressed;
                    mime = "image/jpeg";
                }
            }
            return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
        } catch (IOException e) {
            log.warn("[dap] 读取身份图失败 key={}: {}", key, e.getMessage());
            return null;
        }
    }

    /** 等比缩到 maxWidth 宽 + JPEG q0.82（PNG alpha 铺白底）。失败返回 null（调用方用原图）。 */
    private static byte[] compressToJpeg(byte[] raw, int maxWidth) {
        try {
            java.awt.image.BufferedImage src = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(raw));
            if (src == null) return null;
            int w = src.getWidth(), h = src.getHeight();
            int outW = Math.min(w, maxWidth);
            int outH = (int) Math.round(h * (outW / (double) w));
            java.awt.image.BufferedImage out =
                    new java.awt.image.BufferedImage(outW, outH, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = out.createGraphics();
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, outW, outH);
            g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION,
                    java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(src, 0, 0, outW, outH, null);
            g.dispose();

            var writer = javax.imageio.ImageIO.getImageWritersByFormatName("jpeg").next();
            var param = writer.getDefaultWriteParam();
            param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.82f);
            var bos = new java.io.ByteArrayOutputStream();
            try (var ios = javax.imageio.ImageIO.createImageOutputStream(bos)) {
                writer.setOutput(ios);
                writer.write(null, new javax.imageio.IIOImage(out, null, null), param);
            } finally {
                writer.dispose();
            }
            return bos.toByteArray();
        } catch (Exception e) {
            return null;
        }
    }

    // ── 占位视频（ffmpeg lavfi）────────────────────────────────

    private byte[] placeholderVideo(DapAvatar a) {
        try {
            Path tmp = Files.createTempFile("dap-ph-", ".mp4");
            Process proc = new ProcessBuilder("ffmpeg", "-y",
                    "-f", "lavfi", "-i", "color=c=0x223046:s=720x1080:d=4",
                    "-vf", "drawbox=x=iw/2-120:y=ih/2-160:w=240:h=320:color=white@0.25:t=fill",
                    "-pix_fmt", "yuv420p", tmp.toString())
                    .redirectErrorStream(true).start();
            if (!proc.waitFor(60, java.util.concurrent.TimeUnit.SECONDS) || proc.exitValue() != 0) {
                throw new IOException("ffmpeg 占位视频生成失败");
            }
            byte[] data = Files.readAllBytes(tmp);
            Files.deleteIfExists(tmp);
            return data;
        } catch (Exception e) {
            throw new DapMultimodalClient.DapModelException("DAP_ENGINE_NOT_CONFIGURED",
                    "未在后台为数字人视频用途绑定端点，且本机无 ffmpeg 可生成占位视频");
        }
    }

    // ── 人设解析 ──────────────────────────────────────────────
    // prompt 文本统一走 PromptService（admin「Prompt 管理」可改；resources/prompts/material/dap.*.md 兜底）。

    /** dap.persona 模板的占位符变量（{{desc}} / {{name}} / ...）。 */
    private Map<String, String> personaVars(Map<String, Object> form) {
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("desc", str(form, "desc", "（未提供，自由发挥）"));
        vars.put("name", str(form, "name", "（未提供）"));
        vars.put("age", str(form, "age", "未指定"));
        vars.put("gender", str(form, "gender", "未指定"));
        vars.put("ethnic", str(form, "ethnic", "未指定"));
        vars.put("style", str(form, "style", "写实"));
        vars.put("pose", str(form, "pose", "半身"));
        vars.put("orient", str(form, "orient", "竖屏"));
        return vars;
    }

    private void applyPersona(DapAvatar a, JsonNode persona, String desc) {
        String formName = persona.path("name").asText(null);
        if (formName != null && !formName.isBlank() && (a.getName() == null || a.getName().startsWith("新建") || a.getName().isBlank())) {
            a.setName(formName);
        }
        if (!persona.path("codename").isMissingNode()) a.setCodename(persona.path("codename").asText(a.getCodename()));
        if (!persona.path("archetype").isMissingNode()) a.setArchetype(persona.path("archetype").asText(a.getArchetype()));
        if (!persona.path("tagline").isMissingNode()) a.setTagline(persona.path("tagline").asText(a.getTagline()));
        JsonNode def = persona.path("def");
        if (def.isObject()) {
            Map<String, Object> m = a.defOrEmpty();
            def.fields().forEachRemaining(e -> {
                if (e.getValue().isArray()) {
                    List<String> arr = new ArrayList<>();
                    e.getValue().forEach(x -> arr.add(x.asText()));
                    m.put(e.getKey(), arr);
                } else {
                    m.put(e.getKey(), e.getValue().asText());
                }
            });
            m.put("形象来源", "AI 原创虚构");
            a.setDef(m);
        }
        String gender = persona.path("gender").asText("female");
        if (a.getVoiceName() == null || catalog.isBuiltinVoice(a.getVoiceName())) {
            a.setVoiceName(catalog.recommendVoice(gender));
        }
    }

    private void applyPersonaFallback(DapAvatar a, Map<String, Object> form) {
        String name = str(form, "name", null);
        if (name != null && !name.isBlank()) a.setName(name);
        a.setCodename("custom-avatar");
        a.setArchetype("AI 原创 · " + str(form, "style", "写实"));
        a.setTagline("由文字描述生成的虚构形象");
        Map<String, Object> def = a.defOrEmpty();
        def.put("设定语", str(form, "desc", ""));
        a.setDef(def);
    }

    // ── 进度 / 终态 / 计费 ─────────────────────────────────────

    private DapAvatar avatar(DapJob job) {
        return avatarRepo.findById(job.getAvatarId())
                .orElseThrow(() -> new IllegalStateException("数字人不存在 " + job.getAvatarId()));
    }

    private void progress(DapJob job, int pct, String stage, String eta) {
        job.setPct(Math.min(99, pct));
        if (stage != null && !stage.equals(job.getStage())) {
            log.info("[dap-job] progress id={} type={} pct={} stage={} eta={}",
                    job.getId(), job.getType(), Math.min(99, pct), stage, eta);
            job.setStage(stage);
            job.setStageUpdatedAt(Instant.now());
        }
        job.setEta(eta);
        job.setHeartbeatAt(Instant.now());
        jobRepo.save(job);
    }

    private void finish(DapJob job, String eta) {
        job.setStatus("done");
        job.setStage("done");
        job.setPct(100);
        job.setEta(eta);
        job.setFinishedAt(Instant.now());
        job.setStageUpdatedAt(Instant.now());
        jobRepo.save(job);
    }

    private void fail(DapJob job, String eta, String error) {
        job.setStatus("failed");
        job.setStage("failed");
        job.setEta(eta);
        job.setErrorMessage(error);
        job.setFinishedAt(Instant.now());
        job.setStageUpdatedAt(Instant.now());
        jobRepo.save(job);
    }

    private void commitCredits(DapJob job) {
        if (job.getCost() <= 0) return;
        try {
            creditService.commitHold(DapJobService.REF_TYPE, job.getId() + ":r" + job.getRetryCount(),
                    job.getCost(), job.getKind() + " 完成");
        } catch (Exception e) {
            log.warn("[dap] commitHold 失败 job={}: {}", job.getId(), e.getMessage());
        }
    }

    private void releaseCredits(DapJob job, String why) {
        if (job.getCost() <= 0) return;
        try {
            creditService.releaseHold(DapJobService.REF_TYPE, job.getId() + ":r" + job.getRetryCount(),
                    job.getKind() + " " + why + " · 退回冻结算力");
        } catch (Exception e) {
            log.warn("[dap] releaseHold 失败 job={}: {}", job.getId(), e.getMessage());
        }
    }

    private void checkCancel(DapJob job) {
        DapJob fresh = jobRepo.findById(job.getId()).orElse(job);
        if (fresh.isCancelRequested()) throw new CancelledException();
    }

    private void checkCancelQuiet(DapJob job) {
        DapJob fresh = jobRepo.findById(job.getId()).orElse(job);
        if (fresh.isCancelRequested()) throw new CancelledException();
    }

    private String newDerivId() {
        return "DV-" + UUID.randomUUID().toString().substring(0, 10);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> subMap(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        return v instanceof Map ? (Map<String, Object>) v : new LinkedHashMap<>();
    }

    private static String str(Map<String, Object> m, String key, String dft) {
        Object v = m == null ? null : m.get(key);
        return v == null || String.valueOf(v).isBlank() ? dft : String.valueOf(v);
    }

    private static String firstOrNull(List<String> l) {
        return l == null || l.isEmpty() ? null : l.get(0);
    }

    /** 清洗翻译产物：去引号/围栏与尾部句号，避免拼进模板后出现「.. Keep」之类。 */
    private static String cleanEditPhrase(String s) {
        if (s == null) return "";
        String out = s.strip();
        if (out.startsWith("\"") && out.endsWith("\"") && out.length() > 1) out = out.substring(1, out.length() - 1).strip();
        while (out.endsWith(".") || out.endsWith("。")) out = out.substring(0, out.length() - 1).stripTrailing();
        return out;
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    private static class CancelledException extends RuntimeException {}
}
