package com.aistareco.aep.service;

import com.aistareco.aep.dto.DramaCanvasDetailDto;
import com.aistareco.aep.dto.DramaCanvasSummaryDto;
import com.aistareco.aep.dto.SaveDramaCanvasResultDto;
import com.aistareco.aep.dto.SignCanvasAssetsResultDto;
import com.aistareco.aep.dto.SplitCanvasScriptResultDto;
import com.aistareco.aep.model.DramaCanvas;
import com.aistareco.aep.repository.DramaCanvasRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 短剧画布的存储层（v0.198，设计真源 docs/drama-canvas-plan.md §3–§4 · 契约 packages/types/src/drama-canvas.ts）：
 * 列表 / 新建 / 详情 / 保存 / 软删 / 粘贴剧本切集。生成（运行记录）在另一个服务里，经本类的
 * {@link #requireCanvas} / {@link #readDoc} / {@link #requireVersion} 取已保存的文档（签名是约定，别改）。
 *
 * <p>三条红线（照 AI IP 工作台的事故换来的）：
 * <ol>
 *   <li><b>只存 key</b>：落库前递归剥掉 {@code url} / {@code lastFrameUrl}（签名有 TTL，存进库一小时后就裂图）；
 *       读出时收齐全部 key，<b>一次</b>查归属，只给本人的 key 用 {@link CdnUrlSigner#signKey} 派生地址。</li>
 *   <li><b>文档归客户端</b>：服务端只校验外形、不改内容；保存带 {@code baseDocVersion}，对不上 409
 *       {@code DRAMA_CANVAS_STALE}，由数据库条件更新来判（两个标签页同时存只有一个赢）。</li>
 *   <li><b>生成不改文档</b>：结果写运行记录，前端合进文档再保存（本类不碰运行记录）。</li>
 * </ol>
 */
@Service
public class DramaCanvasService {

    private static final Logger log = LoggerFactory.getLogger(DramaCanvasService.class);

    public static final String DEFAULT_TITLE = "未命名画布";
    public static final String RATIO_PORTRAIT = "9:16";
    public static final String RATIO_LANDSCAPE = "16:9";
    public static final String SOURCE_IDEA = "idea";
    public static final String SOURCE_PASTE = "paste";
    public static final String STEP_SCRIPT = "script";
    public static final String STEP_ASSETS = "assets";
    public static final String STEP_EPISODES = "episodes";

    /** 文档上限：规范化后的 UTF-8 字节数。 */
    public static final long DOC_MAX_BYTES = 4L * 1024 * 1024;
    static final int TITLE_MAX = 128;
    /** 想法标题缺省时取前几个字。 */
    static final int IDEA_TITLE_CHARS = 20;
    static final int IDEA_MAX = 500;
    static final int TEXT_MAX = 100_000;
    static final int EPISODES_MIN = 1;
    static final int EPISODES_MAX = 80;
    static final int EPISODES_DEFAULT = 10;
    static final int DURATION_MIN = 30;
    static final int DURATION_MAX = 180;
    static final int DURATION_DEFAULT = 60;
    static final int STYLE_ID_MAX = 64;
    static final int STYLE_NAME_MAX = 40;
    static final int STYLE_PROMPT_MAX = 300;
    /** 签名地址换新一次最多多少个 key。 */
    static final int SIGN_KEYS_MAX = 100;
    /** 列表封面：每张画布最多看前几张挑中的图（第一张不是本人的就往后找）。 */
    private static final int COVER_CANDIDATES = 20;

    private static final SecureRandom RND = new SecureRandom();

    /** 全剧风格（TS {@code CanvasStyle}）。 */
    public record Style(String id, String name, String prompt) {}

    /** POST 新建的请求体（TS {@code CreateDramaCanvasBody}）。 */
    public record CreateBody(String title, String ratio, String source, String idea, String text,
                             Integer targetEpisodes, Integer episodeDurationSec, Style style) {}

    /** PUT 保存的请求体（TS {@code SaveDramaCanvasBody}）。 */
    public record SaveBody(JsonNode doc, String title, String baseDocVersion) {}

    /** POST script/split 的请求体（TS {@code SplitCanvasScriptBody}）。 */
    public record SplitBody(String text) {}

    /** POST assets/sign 的请求体（TS {@code SignCanvasAssetsBody}）。 */
    public record SignBody(List<String> keys) {}

    private final DramaCanvasRepository repo;
    private final DramaCanvasOwnership ownership;
    private final CdnUrlSigner signer;
    private final ObjectMapper om;

    public DramaCanvasService(DramaCanvasRepository repo,
                              DramaCanvasOwnership ownership,
                              CdnUrlSigner signer,
                              ObjectMapper om) {
        this.repo = repo;
        this.ownership = ownership;
        this.signer = signer;
        this.om = om;
    }

    // ── 给运行记录服务用的公共方法（签名是约定，别改）──────────────────────────────

    /** 取本人的、没删的画布；不存在 / 不是本人的 / 已删 → 404 {@code DRAMA_CANVAS_NOT_FOUND}（不区分，免得成为探测面）。 */
    public DramaCanvas requireCanvas(String userId, String canvasId) {
        if (isBlank(userId) || isBlank(canvasId)) throw notFound();
        return repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(canvasId.trim(), userId).orElseThrow(this::notFound);
    }

    /**
     * 库里那份文档（没有 url；每次返回一份新树，调用方随便改）。
     *
     * <p>库里的文档都是本类规范化后写进去的，解析失败只可能是被手工改坏了 → 500 {@code DRAMA_CANVAS_DOC_CORRUPT}。
     * <b>不</b>回退成空文档：前端拿到空文档会自动保存，把库里那份（也许还能救）整个覆盖掉。
     */
    public JsonNode readDoc(DramaCanvas c) {
        JsonNode doc = parseOrNull(c);
        if (doc == null) {
            throw BusinessException.wrapped(HttpStatus.INTERNAL_SERVER_ERROR, "DRAMA_CANVAS_DOC_CORRUPT",
                    "这张画布的内容读不出来了，请联系客服", "canvas=" + (c == null ? null : c.getId()));
        }
        return doc;
    }

    /**
     * 请求带来的文档版本必须等于库里当前版本，否则 409 {@code DRAMA_CANVAS_STALE}（缺省也算对不上）。
     * 版本覆盖文档内容与标题（{@link DramaCanvasDocs#docVersionOf(String, String)}），前端当不透明串原样带回。
     * {@code error.details.docVersion} 给出库里当前版本。保存与每个生成请求都走这一个判定。
     */
    public void requireVersion(DramaCanvas c, String docVersion) {
        String current = c == null ? null : c.getDocVersion();
        String got = docVersion == null ? null : docVersion.trim();
        if (got == null || got.isEmpty() || !got.equals(current)) throw stale(current);
    }

    // ── 列表 / 详情 ──────────────────────────────────────────────────────────────

    /** 我的画布（按 updatedAt 倒序）。所有画布的封面候选合在一起<b>一次</b>查归属。 */
    @Transactional(readOnly = true)
    public List<DramaCanvasSummaryDto> list(String userId) {
        if (isBlank(userId)) return List.of();
        List<DramaCanvas> rows = repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId);
        List<JsonNode> docs = new ArrayList<>(rows.size());
        List<List<String>> covers = new ArrayList<>(rows.size());
        Set<String> all = new LinkedHashSet<>();
        for (DramaCanvas c : rows) {
            // 列表里一张坏掉的画布不能让整个列表打不开：按空文档出卡片（点进去详情会明确报错）
            JsonNode doc = parseOrNull(c);
            if (doc == null) doc = om.createObjectNode();
            List<String> ks = coverCandidates(doc);
            docs.add(doc);
            covers.add(ks);
            all.addAll(ks);
        }
        Set<String> owned = all.isEmpty() ? Set.of() : ownership.ownedKeys(userId, all);
        List<DramaCanvasSummaryDto> out = new ArrayList<>(rows.size());
        for (int i = 0; i < rows.size(); i++) {
            DramaCanvas c = rows.get(i);
            Stats s = stats(docs.get(i));
            out.add(new DramaCanvasSummaryDto(c.getId(), c.getTitle(), c.getRatio(), s.step,
                    s.episodeCount, s.characterCount, s.sceneCount, s.segmentsDone, s.segmentsTotal,
                    s.episodesAssembled, coverUrl(covers.get(i), owned), iso(c.getCreatedAt()), iso(c.getUpdatedAt())));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public DramaCanvasDetailDto detail(String userId, String canvasId) {
        return toDetail(requireCanvas(userId, canvasId), null);
    }

    // ── 新建 / 保存 / 删除 / 切集 ────────────────────────────────────────────────

    /** 新建（免费）。source=paste 时剧本按「第 X 集」切好放进 script.episodes。 */
    @Transactional
    public DramaCanvasDetailDto create(String userId, CreateBody body) {
        if (isBlank(userId)) throw notFound();
        if (body == null) throw bodyInvalid("没收到新建内容", "body");
        String ratio = trimToNull(body.ratio());
        if (!RATIO_PORTRAIT.equals(ratio) && !RATIO_LANDSCAPE.equals(ratio)) {
            throw bodyInvalid("画幅只能选竖屏 9:16 或横屏 16:9", "ratio");
        }
        String source = trimToNull(body.source());
        if (!SOURCE_IDEA.equals(source) && !SOURCE_PASTE.equals(source)) {
            throw bodyInvalid("请选择粘贴剧本或让 AI 写剧本", "source");
        }
        ObjectNode style = validStyle(body.style());

        ObjectNode script = om.createObjectNode();
        List<String> splitNotes = null;
        String title = trimToNull(body.title());
        if (SOURCE_IDEA.equals(source)) {
            String idea = trimToNull(body.idea());
            if (idea == null) throw bodyInvalid("先说说你的故事想法", "idea");
            if (len(idea) > IDEA_MAX) throw bodyInvalid("故事想法最多 " + IDEA_MAX + " 字", "idea");
            int episodes = inRange(body.targetEpisodes(), EPISODES_DEFAULT, EPISODES_MIN, EPISODES_MAX,
                    "集数要在 " + EPISODES_MIN + " 到 " + EPISODES_MAX + " 之间", "targetEpisodes");
            int duration = inRange(body.episodeDurationSec(), DURATION_DEFAULT, DURATION_MIN, DURATION_MAX,
                    "每集时长要在 " + DURATION_MIN + " 到 " + DURATION_MAX + " 秒之间", "episodeDurationSec");
            script.put("idea", idea);
            script.put("targetEpisodes", episodes);
            script.put("episodeDurationSec", duration);
            script.putArray("episodes");
            if (title == null) title = headOf(idea, IDEA_TITLE_CHARS);
        } else {
            String text = body.text();
            if (text == null || text.isBlank()) throw bodyInvalid("先把剧本粘贴进来", "text");
            if (len(text) > TEXT_MAX) throw bodyInvalid("剧本最多 10 万字，分几张画布来做", "text");
            DramaCanvasScriptSplitter.Result split = DramaCanvasScriptSplitter.split(text);
            if (!split.notes().isEmpty()) splitNotes = List.copyOf(split.notes());
            ArrayNode eps = script.putArray("episodes");
            for (DramaCanvasScriptSplitter.Episode e : split.episodes()) {
                ObjectNode ep = eps.addObject();
                ep.put("no", e.no());
                ep.put("title", e.title());
                ep.put("text", e.text());
            }
        }
        script.putArray("history");
        if (title == null) title = DEFAULT_TITLE;

        ObjectNode doc = om.createObjectNode();
        doc.put("schema", 1);
        doc.put("source", source);
        doc.set("style", style);
        doc.set("script", script);
        doc.putArray("characters");
        doc.putArray("scenes");
        doc.putArray("materials");
        doc.set("board", emptyBoard());
        doc.putArray("episodes");

        String json = DramaCanvasDocs.canonicalJson(doc);
        requireSize(json);
        OffsetDateTime now = now();
        String finalTitle = cap(title);
        DramaCanvas c = DramaCanvas.builder()
                .id(uniqueId())
                .ownerUserId(userId)
                .title(finalTitle)
                .ratio(ratio)
                .docJson(json)
                .docVersion(DramaCanvasDocs.docVersionOf(json, finalTitle))
                .createdAt(now)
                .updatedAt(now)
                .build();
        repo.save(c);
        log.info("[drama-canvas] 新建 id={} owner={} source={} ratio={} episodes={}",
                c.getId(), userId, source, ratio, script.path("episodes").size());
        return toDetail(c, splitNotes);
    }

    /**
     * 保存整份文档（可同时改标题）。顺序：归属 → 版本 → 外形 → 剥 url → 规范化 → 大小 → 条件更新。
     * 新版本 = sha256(规范化文档 + NUL + 标题) 前 16 位：只改标题也会换版本。
     *
     * <p>版本先在内存里比一次（给出明确的 409），再由 {@link DramaCanvasRepository#updateDocIfVersion} 在数据库里判一次
     * （防两个请求同时通过第一次比对、后到的盖掉先到的）。
     */
    @Transactional
    public SaveDramaCanvasResultDto save(String userId, String canvasId, SaveBody body) {
        DramaCanvas c = requireCanvas(userId, canvasId);
        if (body == null) throw docInvalid("body", "没收到画布内容");
        requireVersion(c, body.baseDocVersion());
        String bad = shapeProblem(body.doc());
        if (bad != null) throw docInvalid(bad, "画布内容格式不对");

        ObjectNode doc = ((ObjectNode) body.doc()).deepCopy();
        DramaCanvasDocs.stripDerivedUrls(doc);
        String json = DramaCanvasDocs.canonicalJson(doc);
        long bytes = requireSize(json);
        String title = trimToNull(body.title());
        String nextTitle = title == null ? c.getTitle() : cap(title);
        // 版本覆盖文档 + 标题：只改名也换版本，旧页面带旧版本保存会 409，不会悄悄把新标题盖回去
        String version = DramaCanvasDocs.docVersionOf(json, nextTitle);
        OffsetDateTime now = now();
        String base = c.getDocVersion();

        int n = repo.updateDocIfVersion(c.getId(), userId, base, json, version, nextTitle, now);
        if (n == 0) {
            // 第一次比对之后、写库之前被别的请求抢先改了（或者刚被删了 → 404）
            DramaCanvas cur = requireCanvas(userId, canvasId);
            throw stale(cur.getDocVersion());
        }
        log.debug("[drama-canvas] 保存 id={} version={} bytes={}", c.getId(), version, bytes);
        return new SaveDramaCanvasResultDto(version, iso(now));
    }

    /** 软删（运行记录保留，已花的积分不退）。 */
    @Transactional
    public void delete(String userId, String canvasId) {
        DramaCanvas c = requireCanvas(userId, canvasId);
        int n = repo.softDelete(c.getId(), userId, now());
        if (n == 0) throw notFound();
        log.info("[drama-canvas] 删除 id={} owner={}", c.getId(), userId);
    }

    /** 粘贴的剧本按集切开（免费、同步、不落库）。只校验画布是本人的，不读也不改文档。 */
    @Transactional(readOnly = true)
    public SplitCanvasScriptResultDto split(String userId, String canvasId, SplitBody body) {
        requireCanvas(userId, canvasId);
        String text = body == null ? null : body.text();
        if (text == null || text.isBlank()) throw bodyInvalid("先把剧本粘贴进来", "text");
        if (len(text) > TEXT_MAX) throw bodyInvalid("剧本最多 10 万字，分几张画布来做", "text");
        DramaCanvasScriptSplitter.Result r = DramaCanvasScriptSplitter.split(text);
        List<SplitCanvasScriptResultDto.Episode> eps = new ArrayList<>(r.episodes().size());
        for (DramaCanvasScriptSplitter.Episode e : r.episodes()) {
            eps.add(new SplitCanvasScriptResultDto.Episode(e.no(), e.title(), e.text()));
        }
        return new SplitCanvasScriptResultDto(eps, r.notes());
    }

    /**
     * 签名地址换新（签名有 TTL，画布一开半天，图加载失败时前端按 key 换新地址，不用重拉整份文档）。
     * keys 1–{@value #SIGN_KEYS_MAX} 个，否则 400 {@code DRAMA_CANVAS_BODY_INVALID}；归属<b>一次</b>查完，
     * 只给属于本人的 key 签。不是本人的、不存在的直接不出现在结果里，不报错（和读详情同一条规则）。
     */
    @Transactional(readOnly = true)
    public SignCanvasAssetsResultDto signAssets(String userId, String canvasId, SignBody body) {
        requireCanvas(userId, canvasId);
        List<String> raw = body == null ? null : body.keys();
        if (raw == null || raw.isEmpty()) throw bodyInvalid("没收到要换新地址的图", "keys");
        if (raw.size() > SIGN_KEYS_MAX) throw bodyInvalid("一次最多换 " + SIGN_KEYS_MAX + " 张图的地址", "keys");
        Set<String> keys = new LinkedHashSet<>();
        for (String k : raw) if (k != null && !k.isBlank()) keys.add(k);
        Map<String, String> urls = new LinkedHashMap<>();
        if (keys.isEmpty()) return new SignCanvasAssetsResultDto(urls);
        Set<String> owned = ownership.ownedKeys(userId, keys);
        for (String k : keys) {
            if (!owned.contains(k)) continue;
            String url = signedOrNull(k);
            if (url != null) urls.put(k, url);
        }
        return new SignCanvasAssetsResultDto(urls);
    }

    // ── 出 wire ──────────────────────────────────────────────────────────────────

    /** @param splitNotes 只有 paste 新建那次传切集说明；其余一律 null（不出 wire）。 */
    DramaCanvasDetailDto toDetail(DramaCanvas c, List<String> splitNotes) {
        JsonNode doc = readDoc(c);
        Set<String> keys = new LinkedHashSet<>();
        DramaCanvasDocs.collectAssetKeys(doc, keys);
        Set<String> owned = keys.isEmpty() ? Set.of() : ownership.ownedKeys(c.getOwnerUserId(), keys);
        DramaCanvasDocs.stripDerivedUrls(doc);
        signOwned(doc, owned);
        Stats s = stats(doc);
        return new DramaCanvasDetailDto(c.getId(), c.getTitle(), c.getRatio(), s.step,
                s.episodeCount, s.characterCount, s.sceneCount, s.segmentsDone, s.segmentsTotal,
                s.episodesAssembled, coverUrl(coverCandidates(doc), owned),
                iso(c.getCreatedAt()), iso(c.getUpdatedAt()), doc, c.getDocVersion(), splitNotes);
    }

    /** 只给本人的 key 派生 url / lastFrameUrl；不是本人的不签、不报错（前端显示占位）。只改出 wire 的这棵树。 */
    private void signOwned(JsonNode node, Set<String> owned) {
        if (node == null) return;
        if (node.isObject()) {
            // 先递归再加字段：边遍历边往同一个对象里加字段会 ConcurrentModification
            for (Iterator<JsonNode> it = node.elements(); it.hasNext(); ) signOwned(it.next(), owned);
            ObjectNode o = (ObjectNode) node;
            putSigned(o, "key", "url", owned);
            putSigned(o, "lastFrameKey", "lastFrameUrl", owned);
        } else if (node.isArray()) {
            for (JsonNode child : node) signOwned(child, owned);
        }
    }

    private void putSigned(ObjectNode o, String keyField, String urlField, Set<String> owned) {
        String k = DramaCanvasDocs.text(o, keyField);
        if (k == null || !owned.contains(k)) return;
        String url = signedOrNull(k);
        if (url != null) o.put(urlField, url);
    }

    /** 画布停在哪一步 + 列表卡片上的几个数。 */
    record Stats(String step, int episodeCount, int characterCount, int sceneCount,
                 int segmentsDone, int segmentsTotal, int episodesAssembled) {}

    static Stats stats(JsonNode doc) {
        JsonNode script = doc.path("script");
        int episodeCount = DramaCanvasDocs.arr(script, "episodes").size();
        int characterCount = DramaCanvasDocs.arr(doc, "characters").size();
        int sceneCount = DramaCanvasDocs.arr(doc, "scenes").size();
        int total = 0;
        int done = 0;
        int assembled = 0;
        for (JsonNode ep : DramaCanvasDocs.arr(doc, "episodes")) {
            for (JsonNode seg : DramaCanvasDocs.arr(ep, "segments")) {
                if (!seg.isObject()) continue;
                total++;
                if (DramaCanvasDocs.pickedVideo(seg.path("video")).isPresent()) done++;
            }
            if (DramaCanvasDocs.text(ep.path("assembled"), "key") != null) assembled++;
        }
        String step;
        if (DramaCanvasDocs.text(script, "extractedAt") == null) step = STEP_SCRIPT;
        else if (total == 0) step = STEP_ASSETS;
        else step = STEP_EPISODES;
        return new Stats(step, episodeCount, characterCount, sceneCount, done, total, assembled);
    }

    /** 封面候选：造型挑中的图（按角色、造型顺序）优先，其次场景挑中的图；去重，最多 {@link #COVER_CANDIDATES} 张。 */
    static List<String> coverCandidates(JsonNode doc) {
        Set<String> out = new LinkedHashSet<>();
        for (JsonNode ch : DramaCanvasDocs.arr(doc, "characters")) {
            for (JsonNode look : DramaCanvasDocs.arr(ch, "looks")) {
                if (out.size() >= COVER_CANDIDATES) return new ArrayList<>(out);
                DramaCanvasDocs.pickedImageKey(look.path("images")).ifPresent(out::add);
            }
        }
        for (JsonNode sc : DramaCanvasDocs.arr(doc, "scenes")) {
            if (out.size() >= COVER_CANDIDATES) break;
            DramaCanvasDocs.pickedImageKey(sc.path("images")).ifPresent(out::add);
        }
        return new ArrayList<>(out);
    }

    private String coverUrl(List<String> candidates, Set<String> owned) {
        for (String k : candidates) {
            if (!owned.contains(k)) continue;
            String url = signedOrNull(k);
            if (url != null) return url;
        }
        return null;
    }

    // ── 外形校验 ─────────────────────────────────────────────────────────────────

    /**
     * 外形校验（只校验这几条，不改内容）：顶层字段齐、schema=1、source 合法、各数组 / 对象类型对，
     * 顶层数组里每一项是对象。返回第一处不对的路径（给日志和 details），全对返回 null。
     */
    static String shapeProblem(JsonNode doc) {
        if (doc == null || !doc.isObject()) return "doc";
        JsonNode schema = doc.get("schema");
        if (schema == null || !schema.isIntegralNumber() || schema.asInt() != 1) return "schema";
        JsonNode source = doc.get("source");
        if (source == null || !source.isTextual()
                || !(SOURCE_IDEA.equals(source.asText()) || SOURCE_PASTE.equals(source.asText()))) return "source";
        if (!isObject(doc, "style")) return "style";
        if (!isObject(doc, "script")) return "script";
        JsonNode script = doc.get("script");
        if (!isArrayOfObjects(script, "episodes")) return "script.episodes";
        if (!isArrayOfObjects(script, "history")) return "script.history";
        for (String f : new String[]{"characters", "scenes", "materials", "episodes"}) {
            if (!isArrayOfObjects(doc, f)) return f;
        }
        if (!isObject(doc, "board")) return "board";
        JsonNode board = doc.get("board");
        if (!isObject(board, "positions")) return "board.positions";
        if (!isArrayOfObjects(board, "edges")) return "board.edges";
        JsonNode collapsed = board.get("collapsed");
        if (collapsed == null || !collapsed.isArray()) return "board.collapsed";
        if (!isObject(board, "viewport")) return "board.viewport";
        return null;
    }

    private static boolean isObject(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v != null && v.isObject();
    }

    private static boolean isArrayOfObjects(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        if (v == null || !v.isArray()) return false;
        for (JsonNode x : v) if (!x.isObject()) return false;
        return true;
    }

    private ObjectNode validStyle(Style s) {
        if (s == null) throw bodyInvalid("请选择全剧风格", "style");
        String id = trimToNull(s.id());
        String name = trimToNull(s.name());
        if (id == null || name == null) throw bodyInvalid("请选择全剧风格", "style");
        if (len(id) > STYLE_ID_MAX || len(name) > STYLE_NAME_MAX) throw bodyInvalid("风格名称太长了", "style");
        String prompt = s.prompt() == null ? "" : s.prompt().trim();
        if (len(prompt) > STYLE_PROMPT_MAX) {
            throw bodyInvalid("风格描述最多 " + STYLE_PROMPT_MAX + " 字", "style.prompt");
        }
        ObjectNode o = om.createObjectNode();
        o.put("id", id);
        o.put("name", name);
        o.put("prompt", prompt);
        return o;
    }

    private ObjectNode emptyBoard() {
        ObjectNode board = om.createObjectNode();
        board.putObject("positions");
        board.putArray("edges");
        board.putArray("collapsed");
        ObjectNode vp = board.putObject("viewport");
        vp.put("x", 0);
        vp.put("y", 0);
        vp.put("zoom", 1);
        return board;
    }

    /** 规范化后超过 4MB → 413 {@code DRAMA_CANVAS_TOO_LARGE}；返回字节数。 */
    private static long requireSize(String json) {
        long bytes = json.getBytes(StandardCharsets.UTF_8).length;
        if (bytes > DOC_MAX_BYTES) {
            throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "DRAMA_CANVAS_TOO_LARGE",
                    "画布内容太多了（" + (bytes / 1024) + "KB，上限 4MB），删掉一些再保存",
                    Map.of("bytes", bytes, "maxBytes", DOC_MAX_BYTES));
        }
        return bytes;
    }

    // ── 小工具 ───────────────────────────────────────────────────────────────────

    private JsonNode parseOrNull(DramaCanvas c) {
        String json = c == null ? null : c.getDocJson();
        if (json == null || json.isBlank()) {
            log.error("[drama-canvas] 文档为空 id={}", c == null ? null : c.getId());
            return null;
        }
        try {
            JsonNode n = om.readTree(json);
            if (n != null && n.isObject()) return n;
            log.error("[drama-canvas] 文档不是对象 id={}", c.getId());
        } catch (Exception e) {
            log.error("[drama-canvas] 文档解析失败 id={}: {}", c.getId(), e.getMessage());
        }
        return null;
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = "dcv_" + hex(6);
            if (!repo.existsById(id)) return id;
        }
        throw new IllegalStateException("画布 id 连续撞号");
    }

    private static String hex(int bytes) {
        byte[] b = new byte[bytes];
        RND.nextBytes(b);
        StringBuilder sb = new StringBuilder(bytes * 2);
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    private String signedOrNull(String key) {
        if (key == null || key.isBlank()) return null;
        String url = signer.signKey(key);
        return url == null || url.isBlank() ? null : url;
    }

    /** 落库是微秒精度：返回给前端的时间与之后读回来的逐字相同。 */
    private static OffsetDateTime now() {
        return OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }

    /** ISO 8601（UTC，{@code 2026-09-30T08:15:30.123456Z}）；不随 JVM 时区变样。 */
    static String iso(OffsetDateTime t) {
        return t == null ? null : t.toInstant().toString();
    }

    private static int inRange(Integer v, int dflt, int min, int max, String message, String field) {
        if (v == null) return dflt;
        if (v < min || v > max) throw bodyInvalid(message, field);
        return v;
    }

    /** 字数按码点算（与前端「最多 N 字」一致，emoji 不算两个）。 */
    private static int len(String s) {
        return s == null ? 0 : s.codePointCount(0, s.length());
    }

    /** 前 n 个字，空白压成一个空格。 */
    private static String headOf(String s, int n) {
        String t = s.replaceAll("\\s+", " ").trim();
        if (len(t) <= n) return t;
        return t.substring(0, t.offsetByCodePoints(0, n));
    }

    private static String cap(String title) {
        String t = title.replaceAll("\\s+", " ").trim();
        if (len(t) <= TITLE_MAX) return t;
        return t.substring(0, t.offsetByCodePoints(0, TITLE_MAX));
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private BusinessException notFound() {
        return BusinessException.notFound("DRAMA_CANVAS_NOT_FOUND", "找不到这张画布，可能已经删掉了");
    }

    private static BusinessException bodyInvalid(String message, String field) {
        return new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_BODY_INVALID", message,
                Map.of("field", field));
    }

    /** 给用户的话统一一句；哪一处不对放 details.path（也进日志）。 */
    private static BusinessException docInvalid(String path, String detail) {
        return new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_INVALID_DOC",
                "画布内容格式不对，没保存上。刷新后再试", Map.of("path", path), detail + "：" + path);
    }

    private static BusinessException stale(String currentVersion) {
        return new BusinessException(HttpStatus.CONFLICT, "DRAMA_CANVAS_STALE",
                "这张画布在别的页面改过了，载入最新再改",
                currentVersion == null ? null : Map.of("docVersion", currentVersion));
    }
}
