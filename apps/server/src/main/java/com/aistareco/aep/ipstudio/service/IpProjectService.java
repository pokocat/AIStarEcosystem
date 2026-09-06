package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpProjectDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpProjectSummaryDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpTemplateDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpUploadResultDto;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpCreateProjectRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpUpdateProjectRequest;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** 项目 CRUD + 上传 + runs 投影。 */
@Service
public class IpProjectService {

    private static final Logger log = LoggerFactory.getLogger(IpProjectService.class);

    /** 上传素材（用户照片 / 局部参考图）分类。 */
    public static final String CATEGORY_SOURCE = "ipstudio/source";
    /** 生成产物分类。 */
    public static final String CATEGORY_GEN = "ipstudio/gen";

    /**
     * 只收 JPG / PNG。
     *
     * <p>刻意**不收 WebP**：标准 JDK 的 ImageIO 没有 WebP 读取器，收下来在读尺寸这一步就 400，
     * 等于对着用户宣传一种一定失败的格式（前端 accept 同步去掉 image/webp）。
     */
    private static final Set<String> UPLOAD_EXTS = Set.of("jpg", "jpeg", "png");
    private static final Set<String> UPLOAD_MIMES = Set.of("image/jpeg", "image/png");
    private static final SecureRandom RND = new SecureRandom();

    private final IpProjectRepository projectRepo;
    private final IpRunRepository runRepo;
    private final IpCatalogService catalog;
    private final FileStorageService storage;
    private final IpStudioProperties props;
    private final ObjectMapper om;

    public IpProjectService(IpProjectRepository projectRepo,
                           IpRunRepository runRepo,
                           IpCatalogService catalog,
                           FileStorageService storage,
                           IpStudioProperties props,
                           ObjectMapper om) {
        this.projectRepo = projectRepo;
        this.runRepo = runRepo;
        this.catalog = catalog;
        this.storage = storage;
        this.props = props;
        this.om = om;
    }

    // ── 查询 ──────────────────────────────────────────────────

    public List<IpProjectSummaryDto> list(String userId) {
        return projectRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId)
                .stream().map(this::toSummary).toList();
    }

    /** 属主隔离 + 软删过滤统一在这里，其它服务一律经此取项目。 */
    public IpProject required(String userId, String id) {
        return projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> BusinessException.notFound("IP_PROJECT_NOT_FOUND", "IP 项目不存在或已删除"));
    }

    public IpProjectDto detail(String userId, String id) {
        return toDetail(required(userId, id));
    }

    // ── 创建 / 保存 / 软删 ────────────────────────────────────

    @Transactional
    public IpProjectDto create(String userId, IpCreateProjectRequest req) {
        String templateId = req == null ? null : trimToNull(req.templateId());
        IpTemplateDto tpl = templateId == null ? null
                : catalog.template(templateId).orElseThrow(() ->
                        BusinessException.badRequest("IP_TEMPLATE_NOT_FOUND", "内置工作流不存在：" + templateId));

        String name = req == null ? null : trimToNull(req.name());
        if (name == null) name = tpl != null ? tpl.name() : "未命名 IP 项目";
        if (name.length() > 128) name = name.substring(0, 128);

        JsonNode doc = tpl != null && tpl.doc() != null && tpl.doc().isObject()
                ? tpl.doc().deepCopy()
                : IpDocs.emptyDoc(om);

        IpProject p = IpProject.builder()
                .id(uniqueId())
                .ownerUserId(userId)
                .name(name)
                .templateId(tpl != null ? tpl.id() : null)
                .status(IpProject.STATUS_DRAFT)
                .docJson(writeDoc(doc))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        projectRepo.save(p);
        log.info("[ipstudio] 项目创建 id={} owner={} template={}", p.getId(), userId, p.getTemplateId());
        return toDetail(p);
    }

    @Transactional
    public IpProjectDto update(String userId, String id, IpUpdateProjectRequest req) {
        IpProject p = required(userId, id);
        applyUpdate(p, req);
        projectRepo.save(p);
        return toDetail(p);
    }

    /**
     * 保存 name / doc 到实体（不落库，由调用方 save）—— 供「运行前顺手保存最新文档」复用，
     * 免得先 PUT 再 POST 两次事务里读到两份文档。
     */
    void applyUpdate(IpProject p, IpUpdateProjectRequest req) {
        if (req == null) return;
        String name = trimToNull(req.name());
        if (name != null) p.setName(name.length() > 128 ? name.substring(0, 128) : name);
        if (req.doc() != null && !req.doc().isNull()) {
            IpDocs.requireValidDoc(req.doc());
            String json = writeDoc(req.doc());
            long bytes = json.getBytes(StandardCharsets.UTF_8).length;
            if (bytes > props.getDocMaxBytes()) {
                throw BusinessException.badRequest("IP_DOC_TOO_LARGE",
                        "画布数据过大（" + (bytes / 1024) + "KB），请精简节点或参考图后重试");
            }
            p.setDocJson(json);
        }
        p.setUpdatedAt(Instant.now());
    }

    @Transactional
    public void remove(String userId, String id) {
        IpProject p = required(userId, id);
        p.setDeletedAt(Instant.now());
        p.setUpdatedAt(Instant.now());
        projectRepo.save(p);
    }

    void save(IpProject p) {
        p.setUpdatedAt(Instant.now());
        projectRepo.save(p);
    }

    // ── 上传 ──────────────────────────────────────────────────

    /** 照片 / 参考图上传：只收 jpg/png、≤ 字节上限且最长边 ≤ 像素上限；产物 key 由客户端写进 doc。 */
    public IpUploadResultDto upload(String userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("IP_UPLOAD_INVALID", "请选择要上传的图片");
        }
        if (file.getSize() > props.getUploadMaxBytes()) {
            throw BusinessException.badRequest("IP_UPLOAD_INVALID",
                    "图片超过 " + (props.getUploadMaxBytes() / 1024 / 1024) + "MB 上限，请压缩后重试");
        }
        String original = file.getOriginalFilename();
        String ext = extOf(original);
        String mime = file.getContentType() == null ? null : file.getContentType().toLowerCase(Locale.ROOT);
        boolean okExt = ext != null && UPLOAD_EXTS.contains(ext);
        boolean okMime = mime != null && UPLOAD_MIMES.stream().anyMatch(mime::startsWith);
        if (!okExt && !okMime) {
            throw BusinessException.badRequest("IP_UPLOAD_INVALID", "只支持 JPG / PNG 图片");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (Exception e) {
            throw BusinessException.badRequest("IP_UPLOAD_INVALID", "图片读取失败，请重新上传");
        }
        int[] wh = readDimensions(bytes);
        if (wh == null) {
            throw BusinessException.badRequest("IP_UPLOAD_INVALID", "无法识别的图片内容，请换一张图片");
        }
        int max = Math.max(16, props.getUploadMaxDimension());
        if (wh[0] > max || wh[1] > max) {
            throw BusinessException.badRequest("IP_UPLOAD_INVALID",
                    "图片尺寸过大（" + wh[0] + "×" + wh[1] + "），最长边请不超过 " + max + " 像素");
        }
        Integer w = wh[0], h = wh[1];

        FileStorageService.StoredFile stored = storage.store(
                bytes, CATEGORY_SOURCE, userId, okExt ? ext : "png",
                mime != null && okMime ? mime : "image/png");
        return new IpUploadResultDto(stored.key(), storage.signedUrl(stored.key()), w, h,
                displayName(original, okExt ? ext : "png"));
    }

    /**
     * 只读**文件头**拿宽高（{@code ImageIO.getImageReaders} + {@code reader.getWidth/getHeight}），
     * 不做整图解码。
     *
     * <p>为什么不用 {@code ImageIO.read}：那会真的把像素解出来 —— 一张 200KB 的 PNG 可以声明
     * 50000×50000，解码瞬间要 10GB 堆（decompression bomb）。头部读完就能判尺寸，超限直接拒，
     * 服务器不会为一次上传把自己 OOM 掉。
     *
     * <p>同时这也是「是不是真图片」的判定：没有任何 reader 认领 → 改后缀的假图，返回 null。
     */
    static int[] readDimensions(byte[] bytes) {
        if (bytes == null || bytes.length < 16) return null;
        try (javax.imageio.stream.ImageInputStream iis =
                     javax.imageio.ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (iis == null) return null;
            var readers = javax.imageio.ImageIO.getImageReaders(iis);
            if (readers == null || !readers.hasNext()) return null;
            javax.imageio.ImageReader reader = readers.next();
            try {
                reader.setInput(iis, true, true);
                int w = reader.getWidth(0);
                int h = reader.getHeight(0);
                return w > 0 && h > 0 ? new int[]{w, h} : null;
            } finally {
                reader.dispose();
            }
        } catch (Exception e) {
            log.debug("[ipstudio] 上传图头部解析失败: {}", e.getMessage());
            return null;
        }
    }

    // ── 资产 key 归属闸（客户端提交的 key 一律不可信）─────────

    /**
     * 校验客户端在 doc 里写的 {@code assetKey} 确实是**我们自己为这个用户**生成的 key。
     *
     * <p>为什么必须有这道闸：画布文档是客户端整存整取的，{@code source} / {@code reference} 节点的
     * {@code assetKey} 完全由浏览器写。不校验的话，任何登录用户把别人上传的照片 key 抄进自己的 doc
     * 就能拿别人的脸出图（越权读取）；而 {@code FileStorageService.openForRead} 是
     * {@code Paths.get(localDir, key)} 拼路径、不做包含性检查，一个 {@code ../../etc/passwd}
     * 形状的 key 就能把本机任意文件当参考图 base64 上行给外部模型（路径穿越 + 数据外泄）。
     *
     * <p>合法形状只有两种：本人上传的 {@code ipstudio_source/<uid>/…} 与本人生成的
     * {@code ipstudio_gen/<uid>/…}（前缀由 storage 自己的 key 生成规则派生，见 {@link #keyPrefix}，
     * 不在这里手写猜测 —— 那样一改 {@code buildKey} 的归一规则闸门就会静默失效）。
     */
    public String requireOwnedAssetKey(String userId, String key) {
        if (key == null || key.isBlank()) return null;
        String k = key.trim();
        boolean shapeOk = !k.startsWith("/") && !k.contains("\\") && !k.contains("..")
                && !k.contains("\n") && !k.contains("\r")
                && (k.startsWith(keyPrefix(CATEGORY_SOURCE, userId)) || k.startsWith(keyPrefix(CATEGORY_GEN, userId)));
        if (!shapeOk) {
            log.warn("[ipstudio] 拒绝非法资产 key owner={} key={}", userId, abbreviate(k));
            throw BusinessException.badRequest("IP_ASSET_KEY_INVALID",
                    "画布里引用了不属于你的图片，请重新上传或重新选图");
        }
        return k;
    }

    /**
     * 某用户在某分类下的合法 key 前缀。
     *
     * <p>用 {@link FileStorageService#allocateKey} 现算一个 key 再砍掉文件名 —— 归一规则
     * （category / ownerId 里的 {@code /} 与非法字符会被换成 {@code _}）就永远与真正写入时一致，
     * 不是手写的猜测。{@code allocateKey} 只算字符串、不创建对象，没有副作用。
     */
    private String keyPrefix(String category, String userId) {
        String probe = storage.allocateKey(category, userId, "probe.png");
        if (probe == null) {
            // storage 实现异常（理论不可达）：宁可全拒，也不放行任意 key
            throw BusinessException.badRequest("IP_ASSET_KEY_INVALID", "图片校验失败，请重新上传");
        }
        int slash = probe.lastIndexOf('/');
        return slash < 0 ? probe : probe.substring(0, slash + 1);
    }

    private static String abbreviate(String s) {
        return s.length() <= 120 ? s : s.substring(0, 120) + "…";
    }

    // ── DTO ───────────────────────────────────────────────────

    IpProjectSummaryDto toSummary(IpProject p) {
        return new IpProjectSummaryDto(p.getId(), p.getName(), p.getTemplateId(), p.getStatus(),
                p.getCoverKey() == null ? null : storage.signedUrl(p.getCoverKey()),
                p.getPublishedAvatarId(), iso(p.getCreatedAt()), iso(p.getUpdatedAt()));
    }

    IpProjectDto toDetail(IpProject p) {
        JsonNode doc = resignDocAssetUrls(readDoc(p));
        RunsProjection runs = projectRuns(p.getId(), doc);
        return new IpProjectDto(p.getId(), p.getName(), p.getTemplateId(), p.getStatus(),
                p.getCoverKey() == null ? null : storage.signedUrl(p.getCoverKey()),
                p.getPublishedAvatarId(), iso(p.getCreatedAt()), iso(p.getUpdatedAt()),
                doc, runs.runs(), runs.runsById());
    }

    /** runs 投影结果：{@code runs} 按 nodeId、{@code runsById} 按 runId。 */
    record RunsProjection(Map<String, IpRunDto> runs, Map<String, IpRunDto> runsById) {}

    /**
     * runs 投影：{@code runs} 每个节点取**最近一次**运行（nodeId 键）；{@code runsById} 按 runId 收
     * {@code runs} 的全部，外加 doc 里被 {@code selectedRunId} 显式选中却已不是最新的那一次 ——
     * 用户重跑后可能仍在用上一次的候选图，只给最新一条会让画布上的选中图变成空白。
     */
    private RunsProjection projectRuns(String projectId, JsonNode doc) {
        List<IpRun> all = runRepo.findByProjectIdOrderByCreatedAtDesc(projectId);
        Map<String, IpRunDto> byNode = new LinkedHashMap<>();
        Map<String, IpRunDto> byId = new LinkedHashMap<>();
        Map<String, IpRun> latestByNode = new LinkedHashMap<>();
        for (IpRun r : all) {
            latestByNode.putIfAbsent(r.getNodeId(), r);
        }
        latestByNode.forEach((nodeId, r) -> {
            IpRunDto dto = toRunDto(r);
            byNode.put(nodeId, dto);
            byId.put(r.getId(), dto);
        });

        // doc 里显式选中但已不是最新的 run，按 runId 补进 runsById
        List<String> selected = new ArrayList<>();
        for (JsonNode n : IpDocs.nodes(doc)) {
            if (!IpDocs.T_GENERATE.equals(IpDocs.typeOf(n))) continue;
            String sel = IpDocs.text(IpDocs.dataOf(n), "selectedRunId");
            if (sel != null) selected.add(sel);
        }
        if (!selected.isEmpty()) {
            for (IpRun r : all) {
                if (!selected.contains(r.getId()) || byId.containsKey(r.getId())) continue;
                byId.put(r.getId(), toRunDto(r));
            }
        }
        return new RunsProjection(byNode, byId);
    }

    /**
     * run → wire。候选图的 key 是真值，出 wire 时逐条派生签名 URL（§4.7.7）；
     * {@code inputs._exec} 是服务端执行参数（含 storage key），不出 wire。
     */
    public IpRunDto toRunDto(IpRun r) {
        JsonNode inputs = parseOrEmptyObject(r.getInputJson());
        if (inputs instanceof com.fasterxml.jackson.databind.node.ObjectNode on) on.remove("_exec");
        JsonNode output = signCandidates(parseOrEmptyObject(r.getOutputJson()));
        return new IpRunDto(r.getId(), r.getProjectId(), r.getNodeId(), r.getKind(),
                r.getStatus(), r.getStage(), r.getPct(), r.getCost(),
                r.getErrorCode(), r.getErrorMessage(), inputs, output,
                iso(r.getCreatedAt()), iso(r.getFinishedAt()));
    }

    private JsonNode signCandidates(JsonNode output) {
        if (output == null || !output.isObject()) return output;
        JsonNode arr = output.path("candidates");
        if (!arr.isArray()) return output;
        for (JsonNode c : arr) {
            if (!c.isObject()) continue;
            String key = c.path("key").asText(null);
            if (key == null || key.isBlank()) continue;
            ((com.fasterxml.jackson.databind.node.ObjectNode) c).put("url", storage.signedUrl(key));
        }
        return output;
    }

    /**
     * owner + project 双限定取一次运行行 —— 客户端给的 {@code selectedRunId} 一律按不可信处理。
     *
     * <p>只按 runId 查会让「把别人的（或自己另一个项目的）runId 抄进 doc」变成一次成功的越权读图：
     * 参考图装配会拿它的候选当身份锚，发布会把它的图登记成本项目的资产。
     */
    public java.util.Optional<IpRun> ownedRun(String userId, String projectId, String runId) {
        if (runId == null || runId.isBlank()) return java.util.Optional.empty();
        IpRun run = runRepo.findById(runId).orElse(null);
        if (run == null) return java.util.Optional.empty();
        boolean ok = userId != null && userId.equals(run.getOwnerUserId())
                && projectId != null && projectId.equals(run.getProjectId());
        return ok ? java.util.Optional.of(run) : java.util.Optional.empty();
    }

    /**
     * 某次运行的第 index 张候选的 storage key（越界按夹取处理）。
     *
     * <p>放在这里而不是 {@code IpRunService}：参考图装配（运行前）和发布（运行后）都要用它，
     * 挂在项目服务上两边都能拿，省掉一条「发布依赖运行服务」的无谓依赖。
     *
     * <p>归属不符（非本人 / 非本项目 / 不存在）**一律抛错**，绝不退化成「没选主图」静默继续 ——
     * 那样一次伪造的 doc 就会得到一张「没有身份锚但照价收费」的图，用户还以为锁了脸。
     */
    public String candidateKeyOf(String userId, String projectId, String runId, int index) {
        IpRun run = ownedRun(userId, projectId, runId).orElseThrow(() ->
                BusinessException.notFound("IP_RUN_NOT_FOUND",
                        "选中的那次生成不存在或不属于本项目，请重新生成并选图"));
        JsonNode arr = parseOrEmptyObject(run.getOutputJson()).path("candidates");
        if (!arr.isArray() || arr.isEmpty()) return null;
        int i = Math.max(0, Math.min(arr.size() - 1, index));
        String key = arr.get(i).path("key").asText(null);
        return key == null || key.isBlank() ? null : key;
    }

    // ── 文档读写 ──────────────────────────────────────────────

    /**
     * §4.7.7：doc 是整存整取的 JSON 文档，里面 source / reference 节点的 {@code imageUrl} 只是上传当时的派生值
     * （签名有 TTL、dev 下还带端口），原样返回会过期图裂。真值是 {@code assetKey}，出 wire 时按 key 重签覆盖。
     * 只改出 wire 的这棵树，不回写库。
     */
    JsonNode resignDocAssetUrls(JsonNode doc) {
        for (JsonNode n : IpDocs.nodes(doc)) {
            String type = IpDocs.typeOf(n);
            if (!IpDocs.T_SOURCE.equals(type) && !IpDocs.T_REFERENCE.equals(type)) continue;
            JsonNode data = IpDocs.dataOf(n);
            String key = IpDocs.text(data, "assetKey");
            if (key == null || !(data instanceof com.fasterxml.jackson.databind.node.ObjectNode on)) continue;
            try {
                String url = storage.signedUrl(key);
                if (url != null && !url.isBlank()) on.put("imageUrl", url);
            } catch (RuntimeException e) {
                log.warn("[ipstudio] 重签资产 URL 失败 key={}: {}", key, e.getMessage());
            }
        }
        return doc;
    }

    public JsonNode readDoc(IpProject p) {
        if (p.getDocJson() == null || p.getDocJson().isBlank()) return IpDocs.emptyDoc(om);
        try {
            JsonNode n = om.readTree(p.getDocJson());
            return n.isObject() ? n : IpDocs.emptyDoc(om);
        } catch (Exception e) {
            log.warn("[ipstudio] 项目文档解析失败 id={}: {}", p.getId(), e.getMessage());
            return IpDocs.emptyDoc(om);
        }
    }

    private String writeDoc(JsonNode doc) {
        try {
            return om.writeValueAsString(doc);
        } catch (Exception e) {
            throw BusinessException.badRequest("IP_DOC_INVALID", "画布数据无法序列化");
        }
    }

    JsonNode parseOrEmptyObject(String json) {
        if (json == null || json.isBlank()) return om.createObjectNode();
        try {
            JsonNode n = om.readTree(json);
            return n.isObject() ? n : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
    }

    // ── 小工具 ────────────────────────────────────────────────

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = "IPP-" + hex8();
            if (!projectRepo.existsById(id)) return id;
        }
        return "IPP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    static String hex8() {
        byte[] b = new byte[4];
        RND.nextBytes(b);
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    static String iso(Instant t) {
        return t == null ? null : t.toString();
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String extOf(String filename) {
        if (filename == null) return null;
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return null;
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /** 微信 {@code tmp_*} / 长哈希文件名不进产品 UI（同 clip 域惯例）。 */
    private static String displayName(String original, String ext) {
        String base = original == null ? "" : original.trim();
        int slash = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
        if (slash >= 0) base = base.substring(slash + 1);
        String stem = base.contains(".") ? base.substring(0, base.lastIndexOf('.')) : base;
        boolean unreadable = stem.isEmpty() || stem.startsWith("tmp_") || stem.startsWith("wx")
                || stem.length() > 40 || stem.matches("[0-9a-fA-F]{16,}");
        return unreadable ? "上传图片." + ext : base;
    }
}
