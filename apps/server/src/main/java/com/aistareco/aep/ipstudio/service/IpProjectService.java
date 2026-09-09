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
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
    private final IpTemplateResolver templates;
    private final FileStorageService storage;
    private final com.aistareco.aep.repository.MaterialVideoJobRepository videoJobs;
    private final IpStudioProperties props;
    private final ObjectMapper om;

    public IpProjectService(IpProjectRepository projectRepo,
                           IpRunRepository runRepo,
                           IpCatalogService catalog,
                           IpTemplateResolver templates,
                           FileStorageService storage,
                           IpStudioProperties props,
                           com.aistareco.aep.repository.MaterialVideoJobRepository videoJobs,
                           ObjectMapper om) {
        this.projectRepo = projectRepo;
        this.runRepo = runRepo;
        this.catalog = catalog;
        this.templates = templates;
        this.storage = storage;
        this.props = props;
        this.videoJobs = videoJobs;
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
                .orElseThrow(() -> BusinessException.notFound("IP_PROJECT_NOT_FOUND", "这张画布不存在，或者已经删了"));
    }

    public IpProjectDto detail(String userId, String id) {
        return toDetail(required(userId, id));
    }

    // ── 创建 / 保存 / 软删 ────────────────────────────────────

    @Transactional
    public IpProjectDto create(String userId, IpCreateProjectRequest req) {
        String templateId = req == null ? null : trimToNull(req.templateId());
        // 走 IpTemplateResolver 而不是 catalog：目录里列出来的既有内置模板也有全局示例，
        // 只查 catalog 的话，运营存的示例点开必报「内置工作流不存在」（目录列一套、建的时候查另一套）。
        IpTemplateDto tpl = templateId == null ? null
                : templates.resolve(templateId).orElseThrow(() ->
                        BusinessException.badRequest("IP_TEMPLATE_NOT_FOUND", "工作流不存在或已下线：" + templateId));

        String name = req == null ? null : trimToNull(req.name());
        if (name == null) name = tpl != null ? tpl.name() : "未命名画布";
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
        requireNotStale(p, req.baseDocVersion());
        String name = trimToNull(req.name());
        if (name != null) p.setName(name.length() > 128 ? name.substring(0, 128) : name);
        if (req.doc() != null && !req.doc().isNull()) {
            IpDocs.requireValidDoc(req.doc());
            stripDerivedUrls(req.doc());
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
    /** 归属判定的只读版本 —— 给「不该抛、只该跳过」的场景用（如出 wire 重签）。 */
    boolean ownsAssetKey(String userId, String key) {
        if (userId == null || key == null || key.isBlank()) return false;
        String k = key.trim();
        if (k.startsWith("/") || k.contains("\\") || k.contains("..") || k.contains("\n") || k.contains("\r")) {
            return false;
        }
        // 图片：key 里带 uid，看前缀就够了
        if (k.startsWith(keyPrefix(CATEGORY_SOURCE, userId)) || k.startsWith(keyPrefix(CATEGORY_GEN, userId))) {
            return true;
        }
        // 全局示例的素材：平台自有内容，**所有登录用户都可读**（v0.182）。
        // 这不是放宽越权面 —— 写入侧的 key 一律由调用者的 uid 拼出来，落不到这个前缀下，
        // 所以「可读」不会变成「可写」；而不放行的话，示例工作流换个人打开就是一片空白。
        // ⚠️ 前缀必须**按写入侧的真实形状**算，不能拿常量拼字符串：
        // FileStorageService.buildKey 会 sanitizeSegment(category)，把 `/` 换成 `_` ——
        // 所以 CATEGORY_DEMO="ipstudio/demo" 落地之后是 `ipstudio_demo/<demoId>/…`，
        // 而 `CATEGORY_DEMO + "/"` 拼出来的是 `ipstudio/demo/`，**永远匹配不上**。
        // 结果：示例素材过不了归属闸 → 出 wire 不重签 → 用户打开示例工作流一片空白。
        // 上面 source/gen 两条之所以没事，是因为它们走 keyPrefix() 经 allocateKey 推导，
        // 天然拿到 sanitize 之后的形状。这里改成同一套推导。
        if (k.startsWith(categoryPrefix(IpDemoTemplateService.CATEGORY_DEMO))) {
            return true;
        }
        // 视频：key 是 `material-videos/<jobId>/video.mp4`（可能带 OSS key-prefix），**里面没有 uid** ——
        // 光看前缀一律判成「不是本人的」，于是画布里的视频节点重签不出地址，
        // 刷新之后 content 是空的、视频就此消失（v0.180 线上实测，日志里每次加载都刷两条
        // 「文档里出现非本人资产 key」）。这里改成按 jobId 回查任务的真实归属 ——
        // 不是放宽，是换成一个真的能判归属的办法：owner 必须是本人、分区必须是 ipstudio。
        return ownsVideoKey(userId, k);
    }

    /** `material-videos/<jobId>/…` → 回查 MaterialVideoJob 确认 owner + 分区。 */
    boolean ownsVideoKey(String userId, String key) {
        var m = VIDEO_KEY.matcher(key);
        if (!m.matches()) return false;
        return videoJobs.findById(m.group(1))
                .filter(j -> userId.equals(j.getOwnerUserId()))
                .filter(j -> MaterialVideoJobService.APP_IPSTUDIO.equals(j.getApp()))
                .isPresent();
    }

    /**
     * 成片的存储键。开头那个可选段是 OSS 的 key-prefix（生产是 {@code media/}）——
     * 它来自 {@code CdnUrlSigner#keyOf} 从 URL 反抽，抽出来是**带前缀**的对象键；
     * 而图片那边的 key 是不带前缀的。两种都收，免得为了一个前缀再把配置传进来。
     */
    private static final java.util.regex.Pattern VIDEO_KEY =
            java.util.regex.Pattern.compile("^(?:[^/]+/)?material-videos/([^/]+)/[^/]+$");

    public String requireOwnedAssetKey(String userId, String key) {
        if (key == null || key.isBlank()) return null;
        String k = key.trim();
        // 判定只有一处：{@link #ownsAssetKey}。此前这里抄了一份同样的前缀判断，
        // v0.180 给成片 key 补归属查询时只改了那一处，这条路径照旧拒绝 ——
        // 同一条规则写两遍，改一遍就是这个下场。
        boolean shapeOk = ownsAssetKey(userId, k);
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
    /**
     * 分类级前缀（不含 uid），如 `ipstudio_demo/`。
     *
     * <p>与 {@link #keyPrefix} 同理，经 {@code allocateKey} 推导而不是拼常量 ——
     * 存储层会 sanitize 分类名里的 `/`，硬拼出来的前缀跟真实 key 对不上。
     */
    private String categoryPrefix(String category) {
        // 带一个占位 owner 而不是传 null：存储实现对 null owner 的处理没有约定
        // （真实实现会省掉那一段，mock 可能直接不匹配），而我们只要**第一段**，
        // 有没有 owner 段都不影响结果。
        String probe = storage.allocateKey(category, "probe", "probe.png");
        if (probe == null) {
            throw BusinessException.badRequest("IP_ASSET_KEY_INVALID", "图片校验失败，请重新上传");
        }
        int slash = probe.indexOf('/');
        return slash < 0 ? probe : probe.substring(0, slash + 1);
    }

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
        JsonNode doc = resignDocAssetUrls(readDoc(p), p.getOwnerUserId());
        RunsProjection runs = projectRuns(p.getId(), doc);
        return new IpProjectDto(p.getId(), p.getName(), p.getTemplateId(), p.getStatus(),
                p.getCoverKey() == null ? null : storage.signedUrl(p.getCoverKey()),
                p.getPublishedAvatarId(), iso(p.getCreatedAt()), iso(p.getUpdatedAt()),
                docVersion(p.getDocJson()),
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

        // doc 里显式引用到的历史运行，按 runId 补进 runsById。
        // 画布的图节点把「这张图是哪次运行出来的」记在 metadata.runId 上；
        // 不补的话，用户翻回一张老图时看不到它当时的提示词和花费。
        List<String> selected = new ArrayList<>();
        for (JsonNode n : IpDocs.nodes(doc)) {
            String sel = IpDocs.text(IpDocs.metadataOf(n), "runId");
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

    /**
     * 按存储键批量重签地址。签名有 TTL，画布一开半天，图会在编辑途中过期。
     *
     * <p>非本人的 key 直接抛（{@code requireOwnedAssetKey} 的既有纪律）—— 这是个能拿 key 换 URL
     * 的接口，静默跳过就等于给了一个「试到哪个 key 是别人的」的探测面。
     * 签不出来的 key 不进结果，前端据此保留占位而不是显示破图。
     */
    /** 一次重签的上限：画布上图再多也够用，同时挡住拿这个接口当批量探测器。 */
    private static final int MAX_SIGN_KEYS = 200;

    @Transactional(readOnly = true)
    public Map<String, String> signOwnedKeys(String userId, List<String> keys) {
        Map<String, String> out = new LinkedHashMap<>();
        if (keys == null) return out;
        // 超限**整体拒绝**而不是砍尾：静默丢掉的那几个在前端表现为「签不出来」，
        // 调用方分不清是超限、非法 key 还是存储故障 —— 而且被丢掉的那些根本没过归属闸。
        if (keys.size() > MAX_SIGN_KEYS) {
            throw BusinessException.badRequest("IP_SIGN_TOO_MANY",
                    "一次最多重签 " + MAX_SIGN_KEYS + " 张图，请分批");
        }
        for (String raw : keys) {
            String key = requireOwnedAssetKey(userId, raw);
            if (key == null) continue;
            try {
                String url = storage.signedUrl(key);
                if (url != null && !url.isBlank()) out.put(key, url);
            } catch (RuntimeException e) {
                log.warn("[ipstudio] 重签失败 key={}: {}", key, e.getMessage());
            }
        }
        return out;
    }

    // ── 文档读写 ──────────────────────────────────────────────

    /**
     * 乐观并发：客户端带上「我加载的是哪一版」，服务端据此拒绝覆盖别人的编辑。
     *
     * <p>没有这道闸的话，两个标签页各自打开同一个项目、各改各的节点，
     * 两边都 PUT 整份文档 —— 后到的那次把先到的整块画布抹掉，**不可逆**。
     * 画布文档是整存整取的，所以这不是「丢一个字段」，是丢一整份工作。
     *
     * <p>不传 {@code baseDocVersion} 视为不参与并发控制（老客户端 / 内部调用），
     * 保持向后兼容；新画布一律传。
     */
    private void requireNotStale(IpProject p, String baseDocVersion) {
        if (baseDocVersion == null || baseDocVersion.isBlank()) return;
        if (!baseDocVersion.equals(docVersion(p.getDocJson()))) {
            throw new BusinessException(org.springframework.http.HttpStatus.CONFLICT, "IP_PROJECT_STALE",
                    "这张画布已经有一份更新的内容了。现在保存会把那份覆盖掉，刷新一下再改。");
        }
    }

    /**
     * 文档指纹。
     *
     * <p>v0.162 之前比的是 {@code updatedAt} 字符串，那样做有两个毛病，都会**误报冲突**：
     * <ul>
     *   <li>内存里的 {@code Instant.now()} 是纳秒精度，落库是微秒 —— 存进去再读出来就不等了，
     *       于是「我明明只开了一个窗口，它老说别处改过」；</li>
     *   <li>发布只改 status / publishedAvatarId、并不动文档，却也会 bump {@code updatedAt}，
     *       发布完接着改画布必冲突。</li>
     * </ul>
     * 我们真正要拦的是「存着的那份文档，跟我读到的那份不是同一份」—— 那就直接对文档取指纹，
     * 时间精度和无关字段都进不来。
     */
    static String docVersion(String docJson) {
        String src = docJson == null ? "" : docJson;
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(src.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(16);
            for (int i = 0; i < 8; i++) sb.append(String.format("%02x", d[i]));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    /**
     * 落库前扔掉派生出来的图片地址（§4.7.7）。
     *
     * <p>为什么必须服务端来做：出 wire 时 {@link #resignDocAssetUrls} 会给每个 key 现签一个
     * **带 TTL** 的地址；画布把它读进状态，之后任何一次编辑都会把整份文档 PUT 回来 ——
     * 签名就这么进了库。一小时后重新打开，画布上全是过期地址。
     *
     * <p>指望前端在 PUT 之前自己剥是靠不住的：文档是客户端拥有的，我们不能假设它守规矩。
     * 真值是 {@code storageKey}，地址每次出 wire 现派生。
     */
    /** 节点上放候选产物的两个数组：出图的 images[]、出片的 videos[]（v0.182）。 */
    private static final List<String> CANDIDATE_FIELDS = List.of("images", "videos");

    private static void stripDerivedUrls(JsonNode doc) {
        for (JsonNode n : IpDocs.nodes(doc)) {
            JsonNode md = IpDocs.metadataOf(n);
            if (!(md instanceof ObjectNode mo)) continue;
            // 节点级的图 / 视频 / 音频，画布把地址放在 metadata.content（不是 url）——
            // 图片、视频、音频三种节点都读它。只剥 url 的话，签名地址会原样写进库，
            // 一小时后 TTL 过期，用户重开项目看到的是一片裂图 / 播不了的视频。
            // text 节点的 content 是正文，靠 storageKey 是否存在把它挡在外面。
            if (IpDocs.text(mo, "storageKey") != null) {
                mo.remove("url");
                mo.remove("content");
            }
            // 候选数组：出图的 images[] 与出片的 videos[]（v0.182）—— 两处都要剥，
            // 漏一处就是「历史里有的能放、有的一小时后放不了」。
            for (String field : CANDIDATE_FIELDS) {
                JsonNode arr = mo.path(field);
                if (!arr.isArray()) continue;
                for (JsonNode item : arr) {
                    if (item instanceof ObjectNode io && IpDocs.text(io, "storageKey") != null) io.remove("content");
                }
            }
        }
    }

    /**
     * §4.7.7：doc 是整存整取的 JSON 文档，里面每张图的 {@code url} 只是上传当时派生出来的签名地址 ——
     * 签名带 TTL（默认 1 小时），原样返回就是一小时后满屏图裂。真值是 {@code storageKey}，
     * 出 wire 时按 key 重签覆盖。**只改出 wire 的这棵树，不回写库。**
     *
     * <p>画布把图放在两个地方：节点级的 {@code metadata.storageKey}，和候选图集
     * {@code metadata.images[].storageKey}。两处都要重签，漏一处就是「有的图好的有的裂」。
     *
     * <p><b>只签属主自己的 key。</b>文档是客户端拥有的 —— 用户完全可以把别人的 key
     * 写进自己的画布，然后靠读自己的项目换出一个指向别人图片的签名地址。
     * 这跟 {@link #signOwnedKeys} 是同一个洞的另一扇门。这里选择**跳过**而不是抛：
     * 抛会让一份被污染的文档把整个项目变成打不开，而跳过不产出 URL、也不多泄露任何信息
     * （是不是自己的 key，写文档的人本来就知道）。
     */
    JsonNode resignDocAssetUrls(JsonNode doc, String ownerUserId) {
        for (JsonNode n : IpDocs.nodes(doc)) {
            JsonNode md = IpDocs.metadataOf(n);
            if (!(md instanceof ObjectNode mo)) continue;
            // 重签回 content —— 画布读的是它。此前写的是 url，而**没有任何地方读 url**，
            // 于是节点级的图从来就显示不出来（stripDerivedUrls 把 content 剥掉之后）。
            resignOne(mo, "storageKey", "content", ownerUserId);
            for (String field : CANDIDATE_FIELDS) {
                JsonNode arr = mo.path(field);
                if (!arr.isArray()) continue;
                for (JsonNode item : arr) {
                    if (item instanceof ObjectNode io) resignOne(io, "storageKey", "content", ownerUserId);
                }
            }
        }
        return doc;
    }

    /** 按 key 重签一个字段。签不出来就保留原值 —— 可用性优先，别把已有的图也擦掉（§8.0 观测类例外同理）。 */
    private void resignOne(ObjectNode holder, String keyField, String urlField, String ownerUserId) {
        String key = IpDocs.text(holder, keyField);
        if (key == null) return;
        if (!ownsAssetKey(ownerUserId, key)) {
            log.warn("[ipstudio] 文档里出现非本人资产 key，不重签 owner={} key={}", ownerUserId, abbreviate(key));
            return;
        }
        try {
            String url = storage.signedUrl(key);
            if (url != null && !url.isBlank()) holder.put(urlField, url);
        } catch (RuntimeException e) {
            log.warn("[ipstudio] 重签资产 URL 失败 key={}: {}", key, e.getMessage());
        }
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
