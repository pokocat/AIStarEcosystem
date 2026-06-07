package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapDtos.DerivativeDto;
import com.aistareco.aep.dap.dto.DapDtos.JobDto;
import com.aistareco.aep.dap.dto.DapDtos.LookDto;
import com.aistareco.aep.dap.dto.DapRequests.CreateLookRequest;
import com.aistareco.aep.dap.dto.DapRequests.DescribeRequest;
import com.aistareco.aep.dap.dto.DapRequests.GenerateRequest;
import com.aistareco.aep.dap.dto.DapRequests.IterateRequest;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.model.DapLook;
import com.aistareco.aep.dap.repository.DapDerivativeRepository;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 业务编排：生成 / 迭代 / 精调 / 造型 / 衍生的「校验 + 状态推进 + 建作业」。 */
@Service
public class DapWorkflowService {

    private static final Map<String, String> DERIV_KIND_ZH = Map.of(
            "atlas", "多角度图集", "expr", "表情图集", "scene", "剧情场景图",
            "ward", "换装变体", "d3", "3D 模型", "video", "运镜短视频");

    private final DapAvatarService avatarService;
    private final DapJobService jobService;
    private final DapLookRepository lookRepo;
    private final DapDerivativeRepository derivRepo;
    private final DapCatalogService catalog;
    private final DapSupport support;
    private final FileStorageService storage;
    private final AgnesClient agnes;

    public DapWorkflowService(DapAvatarService avatarService,
                              DapJobService jobService,
                              DapLookRepository lookRepo,
                              DapDerivativeRepository derivRepo,
                              DapCatalogService catalog,
                              DapSupport support,
                              FileStorageService storage,
                              AgnesClient agnes) {
        this.avatarService = avatarService;
        this.jobService = jobService;
        this.lookRepo = lookRepo;
        this.derivRepo = derivRepo;
        this.catalog = catalog;
        this.support = support;
        this.storage = storage;
        this.agnes = agnes;
    }

    private String engineName() {
        return agnes.isConfigured() ? "Agnes Image 2.1" : "占位引擎";
    }

    // ── 形象生成 ──────────────────────────────────────────────

    public JobDto generate(String userId, String avatarId, GenerateRequest req) {
        DapAvatar a = avatarService.required(userId, avatarId);
        boolean upload = "upload".equals(req.mode());

        Map<String, Object> payload = new LinkedHashMap<>();
        if (req.form() != null) payload.put("form", formMap(req.form()));
        if (req.captureId() != null) payload.put("captureId", req.captureId());

        if (upload) {
            boolean hasPhotos = !avatarService.photosOf(a.getId()).isEmpty();
            boolean hasCapture = req.captureId() != null;
            if (!hasPhotos && !hasCapture) {
                throw BusinessException.badRequest("DAP_NO_SOURCE", "请先上传照片或完成动作录制");
            }
        }
        a.setStatus("proofing");
        avatarService.save(a);

        String type = upload ? DapJob.T_GENERATE_UPLOAD : DapJob.T_GENERATE;
        String kind = upload ? "真人复刻生成" : "形象生成";
        DapJob job = jobService.submit(userId, a, type, kind, engineName(),
                jobService.priceOf(type, null), upload ? "约 30 秒" : "约 60 秒", payload);
        return JobDto.from(job, support::hm);
    }

    /** 人设解析（同步小步；完整生成请走 generate）。 */
    public Map<String, Object> describe(String userId, String avatarId, DescribeRequest req) {
        DapAvatar a = avatarService.required(userId, avatarId);
        if (req.desc() != null) a.setDescPrompt(req.desc());
        Map<String, Object> form = formMap(req);
        a.setForm(form);
        if (req.name() != null && !req.name().isBlank()) a.setName(req.name());
        avatarService.save(a);
        return Map.of("ok", true, "avatarId", a.getId());
    }

    public JobDto iterate(String userId, String avatarId, IterateRequest req) {
        DapAvatar a = avatarService.required(userId, avatarId);
        if (a.getImageKey() == null) {
            throw BusinessException.badRequest("DAP_NO_IMAGE", "请先生成并挑选形象");
        }
        if (req.instruction() == null || req.instruction().isBlank()) {
            throw BusinessException.badRequest("DAP_INSTRUCTION_REQUIRED", "请输入修改指令");
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("instruction", req.instruction().trim());
        DapJob job = jobService.submit(userId, a, DapJob.T_ITERATE, "形象迭代", engineName(),
                jobService.priceOf(DapJob.T_ITERATE, null), "约 30 秒", payload);
        return JobDto.from(job, support::hm);
    }

    public JobDto warp(String userId, String avatarId, Map<String, Object> params) {
        DapAvatar a = avatarService.required(userId, avatarId);
        if (a.getImageKey() == null) {
            throw BusinessException.badRequest("DAP_NO_IMAGE", "请先生成并挑选形象");
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("params", params == null ? Map.of() : params);
        DapJob job = jobService.submit(userId, a, DapJob.T_WARP, "几何精调", engineName(),
                jobService.priceOf(DapJob.T_WARP, null), "约 30 秒", payload);
        return JobDto.from(job, support::hm);
    }

    // ── 造型 ──────────────────────────────────────────────────

    public List<LookDto> looks(String userId, String avatarId) {
        avatarService.required(userId, avatarId);
        return lookRepo.findByAvatarIdOrderByCreatedAtDesc(avatarId).stream()
                .map(l -> LookDto.from(l, storage::signedUrl))
                .toList();
    }

    public LookDto createLook(String userId, String avatarId, CreateLookRequest req) {
        DapAvatar a = avatarService.required(userId, avatarId);
        if (a.getImageKey() == null) {
            throw BusinessException.badRequest("DAP_NO_IMAGE", "数字人还没有定妆形象，先完成创建再设计造型");
        }
        boolean hasPrompt = req.prompt() != null && !req.prompt().isBlank();
        boolean hasScene = req.sceneId() != null && !req.sceneId().isBlank();
        if (!hasPrompt && !hasScene) {
            throw BusinessException.badRequest("DAP_LOOK_INPUT_REQUIRED", "请描述造型或选择一个场景");
        }
        String label = hasScene ? catalog.sceneName(req.sceneId())
                : req.prompt().length() > 12 ? req.prompt().substring(0, 12) + "…" : req.prompt();

        DapLook look = DapLook.builder()
                .id("LK-" + UUID.randomUUID().toString().substring(0, 8))
                .avatarId(a.getId())
                .ownerUserId(userId)
                .label(label)
                .source(hasScene ? "scene" : "design")
                .prompt(req.prompt())
                .sceneId(req.sceneId())
                .status("running")
                .createdAt(Instant.now())
                .build();
        lookRepo.save(look);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("lookId", look.getId());
        DapJob job = jobService.submit(userId, a, DapJob.T_LOOK, "造型设计", engineName(),
                jobService.priceOf(DapJob.T_LOOK, null), "约 30 秒", payload);
        look.setJobId(job.getId());
        lookRepo.save(look);
        return LookDto.from(look, storage::signedUrl);
    }

    // ── 衍生 ──────────────────────────────────────────────────

    public List<DerivativeDto> derivatives(String userId, String avatarId) {
        avatarService.required(userId, avatarId);
        return derivRepo.findByAvatarIdOrderByDerivKeyAscIdxAsc(avatarId).stream()
                .map(d -> DerivativeDto.from(d, storage::signedUrl))
                .toList();
    }

    public JobDto createDerivative(String userId, String avatarId, String derivKey, String templateId) {
        DapAvatar a = avatarService.required(userId, avatarId);
        String key = derivKey == null ? "" : derivKey;
        if (!DERIV_KIND_ZH.containsKey(key)) {
            throw BusinessException.badRequest("DAP_BAD_DERIV", "未知衍生类型：" + derivKey);
        }
        if (a.getImageKey() == null) {
            throw BusinessException.badRequest("DAP_NO_IMAGE", "数字人还没有定妆形象，先完成创建再生成衍生");
        }
        Object st = a.derivOrEmpty().get(key);
        if ("running".equals(st)) {
            throw BusinessException.badRequest("DAP_DERIV_RUNNING", DERIV_KIND_ZH.get(key) + "正在生成中，请稍候");
        }

        String prevStatus = a.getStatus();
        Map<String, Object> deriv = a.derivOrEmpty();
        deriv.put(key, "running");
        a.setDeriv(deriv);
        if ("finalized".equals(prevStatus) || "archived".equals(prevStatus)) {
            a.setStatus("deriving");
        }
        avatarService.save(a);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("derivKey", key);
        payload.put("prevStatus", prevStatus);
        if (templateId != null) payload.put("templateId", templateId);

        String engine = "video".equals(key)
                ? (agnes.isConfigured() ? "Agnes Video 2.0" : "占位引擎")
                : engineName();
        String eta = "video".equals(key) ? "约 3-6 分钟" : "约 1-2 分钟";
        DapJob job = jobService.submit(userId, a, DapJob.T_DERIVE, DERIV_KIND_ZH.get(key), engine,
                jobService.priceOf(DapJob.T_DERIVE, key), eta, payload);
        return JobDto.from(job, support::hm);
    }

    private static Map<String, Object> formMap(DescribeRequest f) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (f == null) return m;
        if (f.desc() != null) m.put("desc", f.desc());
        if (f.style() != null) m.put("style", f.style());
        if (f.name() != null) m.put("name", f.name());
        if (f.age() != null) m.put("age", f.age());
        if (f.gender() != null) m.put("gender", f.gender());
        if (f.ethnic() != null) m.put("ethnic", f.ethnic());
        if (f.orient() != null) m.put("orient", f.orient());
        if (f.pose() != null) m.put("pose", f.pose());
        return m;
    }
}
