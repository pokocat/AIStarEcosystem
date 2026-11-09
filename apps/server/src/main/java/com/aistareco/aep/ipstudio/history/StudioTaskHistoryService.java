package com.aistareco.aep.ipstudio.history;

import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.repository.DapJobRepository;
import com.aistareco.aep.enterprise.repository.EnterpriseRepository;
import com.aistareco.aep.ipstudio.director.DirectorWorkRepository;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * 账号「任务历史」：把画布、AI 图片 / 视频、导演台、对话（都是 {@link IpRun}）和数字人任务（{@link DapJob}）
 * 合成一份按时间倒序的列表，每条带实际消耗的积分。
 *
 * <p>积分只读既有真值：IpRun 走 {@link IpProjectService#toRunDto}（与画布任务弹层同一套 breakdown，
 * 区分普通积分、模型赠款、冻结中与退回）；数字人任务读 {@code cost}。这里不新增任何计费口径。
 */
@Service
public class StudioTaskHistoryService {
    public static final int PAGE_SIZE = 20;
    /** 汇总最多看这么多条；超出时 summary.partial=true，界面照实说明。 */
    static final int SUMMARY_LIMIT = 300;
    /** 一次合并最多往后翻这么多条，防止深翻页把两张表整个读出来。 */
    static final int MAX_DEPTH = 1000;

    static final List<String> IMAGE = List.of("generate", "identity", "studio-image");
    static final List<String> VIDEO = List.of("studio-video", "studio-lip-sync", "studio-assemble");
    static final List<String> AUDIO = List.of("studio-audio");
    static final List<String> DIALOGUE = List.of("studio-dialogue", "studio-assistant");
    /** 不是生成任务：采纳记录、模板、示例、预设。 */
    static final List<String> NOT_GENERATION = List.of("studio-adopt", "template", "example", "preset");
    static final Set<String> TYPES = Set.of("all", "image", "video", "audio", "text", "dialogue", "digital-human");
    static final Set<String> STATUSES = Set.of("running", "done", "failed");

    public record Credits(long spent, long scopedSpent, long pending, long released) {}
    public record Payer(String type, String name) {}
    public record Item(String id, String source, String sourceId, String sourceTitle, String type, String kind, String title,
                       String status, int pct, Integer queuePosition, String createdAt, String finishedAt,
                       Credits credits, Payer payer, String errorCode, String errorMessage, String href) {}
    public record Summary(long spent, long scopedSpent, long released, long count, long running, boolean partial) {}
    public record Page(List<Item> items, int page, boolean hasMore, Summary summary) {}

    private final IpRunRepository runs;
    private final DapJobRepository dapJobs;
    private final IpProjectRepository projects;
    private final DirectorWorkRepository works;
    private final EnterpriseRepository enterprises;
    private final IpProjectService projectService;

    public StudioTaskHistoryService(IpRunRepository runs, DapJobRepository dapJobs, IpProjectRepository projects,
                                    DirectorWorkRepository works, EnterpriseRepository enterprises, IpProjectService projectService) {
        this.runs = runs; this.dapJobs = dapJobs; this.projects = projects; this.works = works;
        this.enterprises = enterprises; this.projectService = projectService;
    }

    @Transactional(readOnly = true)
    public Page list(String user, String status, String type, int days, int page) {
        String t = type == null || type.isBlank() ? "all" : type;
        if (!TYPES.contains(t)) throw BusinessException.badRequest("TASK_HISTORY_INVALID", "不支持的任务类型");
        List<String> statuses = status == null || status.isBlank() ? List.copyOf(STATUSES) : List.of(status);
        if (!STATUSES.containsAll(statuses)) throw BusinessException.badRequest("TASK_HISTORY_INVALID", "不支持的任务状态");
        if (days < 0 || days > 3650) throw BusinessException.badRequest("TASK_HISTORY_INVALID", "时间范围无效");
        int p = Math.max(0, page);
        if ((p + 1) * PAGE_SIZE > MAX_DEPTH) throw BusinessException.badRequest("TASK_HISTORY_TOO_DEEP", "请缩小时间范围后再查看更早的任务");
        Instant from = days == 0 ? Instant.EPOCH : Instant.now().minus(Duration.ofDays(days));
        Names names = names(user);

        // 状态按显示状态筛：视频任务的状态取自它的视频子任务，任务行本身可能还记着 done，数据库层面筛不准。
        // 所以按时间顺序取出、逐条投影后再筛，不够就把取数窗口翻倍，最多翻到 MAX_DEPTH。
        int want = (p + 1) * PAGE_SIZE + 1;
        List<Item> matched = new ArrayList<>();
        int limit = Math.min(MAX_DEPTH, Math.max(want * 2, 60));
        while (true) {
            List<Row> rows = rows(user, from, t, List.copyOf(STATUSES), limit);
            matched.clear();
            for (Row row : rows) {
                Item it = item(row, names);
                if (statuses.contains(it.status()) && matched.add(it) && matched.size() >= want) break;
            }
            if (matched.size() >= want || rows.size() < limit || limit >= MAX_DEPTH) break;
            limit = Math.min(MAX_DEPTH, limit * 2);
        }
        int start = Math.min(matched.size(), p * PAGE_SIZE);
        int end = Math.min(matched.size(), start + PAGE_SIZE);
        List<Item> items = new ArrayList<>(matched.subList(start, end));

        // 汇总只看时间窗和类型，不看状态筛选：「近 30 天消耗」不因为切到「失败」而变。
        List<Row> window = rows(user, from, t, List.copyOf(STATUSES), SUMMARY_LIMIT + 1);
        boolean partial = window.size() > SUMMARY_LIMIT;
        long spent = 0, scoped = 0, released = 0, running = 0;
        for (Row row : window.subList(0, Math.min(window.size(), SUMMARY_LIMIT))) {
            Item it = item(row, names);
            spent += it.credits().spent(); scoped += it.credits().scopedSpent(); released += it.credits().released();
            if ("running".equals(it.status())) running++;
        }
        return new Page(items, p, matched.size() > end, new Summary(spent, scoped, released, Math.min(window.size(), SUMMARY_LIMIT), running, partial));
    }

    /** 两个来源各取前 want 条，按时间合并后截断。 */
    private List<Row> rows(String user, Instant from, String type, List<String> statuses, int want) {
        var limit = PageRequest.of(0, want);
        List<Row> out = new ArrayList<>();
        if (!"digital-human".equals(type)) {
            List<IpRun> found = switch (type) {
                case "image" -> runs.historyIn(user, from, IMAGE, statuses, limit);
                case "video" -> runs.historyIn(user, from, VIDEO, statuses, limit);
                case "audio" -> runs.historyIn(user, from, AUDIO, statuses, limit);
                case "dialogue" -> runs.historyIn(user, from, DIALOGUE, statuses, limit);
                case "text" -> runs.historyLike(user, from, "studio-%", concat(NOT_GENERATION, IMAGE, VIDEO, AUDIO, DIALOGUE), statuses, limit);
                default -> runs.historyLike(user, from, "%", NOT_GENERATION, statuses, limit);
            };
            for (IpRun r : found) out.add(new Row(r.getCreatedAt(), r.getId(), r, null));
        }
        if ("all".equals(type) || "digital-human".equals(type)) {
            for (DapJob j : dapJobs.history(user, from, statuses, limit)) out.add(new Row(j.getCreatedAt(), j.getId(), null, j));
        }
        out.sort(Comparator.comparing(Row::at, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Row::id, Comparator.reverseOrder()));
        return out.size() > want ? out.subList(0, want) : out;
    }

    private Item item(Row row, Names names) {
        return row.run() != null ? runItem(row.run(), names) : dapItem(row.job());
    }

    private Item runItem(IpRun r, Names names) {
        IpRunDto dto = projectService.toRunDto(r);
        boolean director = IpRun.HOST_DIRECTOR.equals(r.getHostType());
        String type = typeOf(r.getKind());
        String sourceTitle = director ? names.works().get(r.getProjectId()) : names.projects().get(r.getProjectId());
        String href = director ? "/director/" + r.getProjectId() : "/projects/" + r.getProjectId();
        Payer payer = r.getEnterpriseId() == null ? new Payer("personal", null)
                : new Payer("enterprise", names.enterprise(r.getEnterpriseId()));
        Integer queue = dto.queue() == null ? null : (int) dto.queue().position();
        return new Item(r.getId(), director ? "director" : "canvas", r.getProjectId(), sourceTitle, type, r.getKind(),
                title(r.getKind(), director), dto.status(), dto.pct(), queue, dto.createdAt(), dto.finishedAt(),
                credits(dto), payer, dto.errorCode(), dto.errorMessage(), href);
    }

    private Item dapItem(DapJob j) {
        String status = j.getStatus();
        long cost = Math.max(0, j.getCost());
        Credits credits = "running".equals(status) ? new Credits(0, 0, cost, 0)
                : "done".equals(status) ? new Credits(cost, 0, 0, 0) : new Credits(0, 0, 0, 0);
        String title = j.getKind() == null || j.getKind().isBlank() ? "数字人任务" : j.getKind();
        return new Item(j.getId(), "digital-human", j.getAvatarId(), j.getCharName(), "digital-human", j.getType(), title,
                status, j.getPct(), null, iso(j.getCreatedAt()), iso(j.getFinishedAt()), credits, new Payer("personal", null),
                null, "failed".equals(status) ? j.getErrorMessage() : null,
                j.getAvatarId() == null ? "/studio#/library" : "/studio#/avatar/" + j.getAvatarId());
    }

    /** 读 toRunDto 已算好的 breakdown；没有（旧任务）时按 cost 和状态归类。 */
    static Credits credits(IpRunDto dto) {
        JsonNode b = dto.output() == null ? null : dto.output().path("billingBreakdown");
        if (b == null || b.isMissingNode() || b.isNull()) {
            long cost = Math.max(0, dto.cost());
            return "running".equals(dto.status()) ? new Credits(0, 0, cost, 0) : new Credits(cost, 0, 0, 0);
        }
        long scoped = b.path("spent").path("scopedCredits").asLong();
        long spent = scoped + b.path("spent").path("walletCredits").asLong();
        long pending = b.path("pending").path("scopedCredits").asLong() + b.path("pending").path("walletCredits").asLong();
        long released = b.path("released").path("scopedCredits").asLong() + b.path("released").path("walletCredits").asLong();
        // 视频任务的 cost 另含提示词优化那一笔（单独结算，不在视频的 breakdown 里），补进已消耗。
        long extra = Math.max(0, dto.cost() - spent - pending);
        return new Credits(spent + extra, scoped, pending, released);
    }

    static String typeOf(String kind) {
        if (IMAGE.contains(kind)) return "image";
        if (VIDEO.contains(kind)) return "video";
        if (AUDIO.contains(kind)) return "audio";
        if (DIALOGUE.contains(kind)) return "dialogue";
        return "text";
    }

    static String title(String kind, boolean director) {
        String label = switch (kind == null ? "" : kind) {
            case "generate", "studio-image" -> "生成图片";
            case "identity" -> "生成形象";
            case "studio-video" -> "生成视频";
            case "studio-lip-sync" -> "口型同步";
            case "studio-assemble" -> "合成成片";
            case "studio-audio" -> "配音";
            case "studio-dialogue", "studio-assistant" -> "创作助手对话";
            case "studio-script" -> "写剧本";
            case "studio-storyboard" -> "写分镜脚本";
            case "studio-recreation" -> "拆解参考视频";
            case "studio-text" -> "写文案";
            case "studio-check" -> "检查画面";
            case "studio-asset-extract" -> "提取资产";
            default -> "生成文字";
        };
        return director ? "导演台 · " + label : label;
    }

    private Names names(String user) {
        Map<String, String> projectNames = new HashMap<>(), workNames = new HashMap<>();
        for (Object[] row : projects.namesOf(user)) projectNames.put((String) row[0], (String) row[1]);
        for (Object[] row : works.namesOf(user)) workNames.put((String) row[0], (String) row[1]);
        return new Names(projectNames, workNames, new HashMap<>());
    }

    private record Row(Instant at, String id, IpRun run, DapJob job) {}

    private final class Names {
        private final Map<String, String> projects, works, enterprises;
        Names(Map<String, String> projects, Map<String, String> works, Map<String, String> enterprises) {
            this.projects = projects; this.works = works; this.enterprises = enterprises;
        }
        Map<String, String> projects() { return projects; }
        Map<String, String> works() { return works; }
        String enterprise(String id) {
            return enterprises.computeIfAbsent(id, key -> StudioTaskHistoryService.this.enterprises.findById(key).map(e -> e.getName()).orElse(null));
        }
    }

    @SafeVarargs
    private static List<String> concat(List<String>... lists) {
        List<String> out = new ArrayList<>();
        for (List<String> l : lists) out.addAll(l);
        return out;
    }

    private static String iso(Instant at) { return at == null ? null : at.toString(); }
}
