package com.aistareco.aep.service;

import com.aistareco.aep.dto.StudioOperationsDashboardDto;
import com.aistareco.aep.dto.StudioOperationsDashboardDto.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Studio 一期运营看板的只读聚合层。
 *
 * <p>这里刻意不调用 {@code scripts/ops/credit-reconcile.sh}，也不读取服务器文件：网页请求只查询
 * 应用自己的数据库。A-I 的查询语义与 runbook 一致；代码中的 hold 真值枚举是 ACTIVE，而旧脚本中的
 * “HELD”是展示用语，避免因此把在途冻结漏成 0。
 */
@Service
@Transactional(readOnly = true)
public class StudioOperationsDashboardService {
    static final ZoneId BEIJING = ZoneId.of("Asia/Shanghai");
    static final int MAX_TECH_SAMPLES_PER_SOURCE = 50_000;
    static final Pattern PHONE = Pattern.compile("(?<!\\d)(1\\d{2})\\d{4}(\\d{4})(?!\\d)");
    static final Set<String> ISSUE_TYPES = Set.of(
            "GIFT", "ADJUST", "LICENSE_GRANT", "SCOPED_GRANT", "RECHARGE", "REFUND_CASH",
            "TRANSFER_IN", "TRANSFER_OUT"
    );

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public StudioOperationsDashboardService(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public StudioOperationsDashboardDto dashboard(int requestedDays) {
        int days = allowedDays(requestedDays);
        Instant generatedAt = Instant.now();
        ZonedDateTime endBj = generatedAt.atZone(BEIJING);
        Instant end = endBj.toInstant();
        Instant start = endBj.toLocalDate().minusDays(days - 1L).atStartOfDay(BEIJING).toInstant();

        List<ModelSpend> modelSpend = modelSpend(start);
        Health health = health(generatedAt, modelSpend);
        Business business = business(start, end, days, modelSpend);
        Technology technology = technology(start, end);
        Integrations integrations = integrations();
        return new StudioOperationsDashboardDto(generatedAt, "Asia/Shanghai",
                new Window(days, start, end, days == 1 ? "今天" : "近 " + days + " 天"),
                health, business, technology, integrations);
    }

    private Health health(Instant now, List<ModelSpend> models) {
        List<ReconciliationCheck> checks = List.of(
                check("A", "钱包分桶之和不等于总余额", count("select count(*) from aep_wallets where total_balance <> gift_balance + license_balance + recharge_balance")),
                check("B", "出现负余额", count("select count(*) from aep_wallets where gift_balance < 0 or license_balance < 0 or recharge_balance < 0 or pending_balance < 0 or total_balance < 0")),
                check("C", "总余额不等于流水累计", count("select count(*) from aep_wallets w left join (select wallet_id, sum(case when entry_type='SPEND' or entry_type like 'SCOPED%' then 0 else amount end) s from aep_ledger_entries group by wallet_id) l on l.wallet_id=w.id where w.total_balance <> coalesce(l.s,0)")),
                check("D", "冻结余额不等于流水累计", count("select count(*) from aep_wallets w left join (select wallet_id, sum(case when entry_type='FREEZE' then -amount when entry_type='UNFREEZE' then -amount when entry_type='SPEND' then amount else 0 end) p from aep_ledger_entries group by wallet_id) l on l.wallet_id=w.id where w.pending_balance <> coalesce(l.p,0)")),
                check("E", "赠款分桶之和不等于发放额", count("select count(*) from aep_credit_grants where amount <> available + frozen + spent + expired")),
                check("F", "赠款出现负数", count("select count(*) from aep_credit_grants where available < 0 or frozen < 0 or spent < 0 or expired < 0")),
                check("G", "已结束冻结仍有剩余", count("select count(*) from aep_credit_holds where status in ('COMMITTED','RELEASED') and remaining_amount <> 0")),
                check("H", "模型扣费结算拆分不平", count("select count(*) from aep_model_charges where settled_payable_credits is not null and settled_payable_credits <> coalesce(settled_scoped_credits,0) + coalesce(settled_wallet_credits,0)")),
                check("I", "赠款活动发放超限", count("select count(*) from aep_credit_campaigns where issued > total_issue_limit"))
        );
        long stuck = count("select count(*) from aep_credit_holds where status='ACTIVE' and created_at < ?", now.minus(Duration.ofHours(6)));
        long abnormal = models.stream().filter(m -> m.jobs() >= 5 && m.refunded() * 2 >= m.jobs()).count();
        boolean issue = stuck > 0 || abnormal > 0 || checks.stream().anyMatch(c -> c.count() > 0);
        // 定时 agent 的报告目前没有应用内安全读取通道。不能因 DB 此刻正常就伪称 agent 最近运行成功。
        IntegrationState agent = new IntegrationState("unavailable", null, null,
                "对账 agent 报告仍在仓库外目录，尚无安全只读适配器；本页健康检查是当前数据库即时重算。", null);
        return new Health(issue ? "issues" : "partial", checks, stuck, abnormal, agent);
    }

    private ReconciliationCheck check(String id, String label, long value) {
        return new ReconciliationCheck(id, label, value, value == 0 ? "ok" : "issue", value > 0);
    }

    private Business business(Instant start, Instant end, int days, List<ModelSpend> models) {
        List<DailySpend> points = dailySpend(start, end, days);
        long wallet = points.stream().mapToLong(DailySpend::walletCredits).sum();
        long grant = points.stream().mapToLong(DailySpend::grantCredits).sum();
        long total = wallet + grant;
        SpendTotals totals = new SpendTotals(wallet, grant, total, yuan(total));
        List<FeatureSpend> features = featureSpend(start);

        String placeholders = ISSUE_TYPES.stream().map(x -> "?").reduce((a, b) -> a + "," + b).orElse("?");
        List<Object> issueParams = new ArrayList<>(ISSUE_TYPES);
        issueParams.add(Timestamp.from(start));
        issueParams.add(Timestamp.from(end));
        long issued = number(jdbc.queryForObject(
                "select coalesce(sum(case when amount > 0 then amount else 0 end),0) from aep_ledger_entries where entry_type in (" + placeholders + ") and created_at >= ? and created_at < ?",
                Long.class, issueParams.toArray()));
        long walletBalance = number(jdbc.queryForObject("select coalesce(sum(total_balance),0) from aep_wallets", Long.class));
        long grantAvailable = number(jdbc.queryForObject("select coalesce(sum(available + frozen),0) from aep_credit_grants", Long.class));
        IssuanceSummary issuance = new IssuanceSummary(issued, yuan(issued), walletBalance, grantAvailable,
                "unavailable", "普通赠送进入混合余额桶，当前账本不能逐笔严谨归因后续消耗；模型赠款可在后续按 grant_id 单独补充。余额与赠款分开列示，未重复相加为收入。" );
        return new Business(totals, points, models, features, issuance);
    }

    /**
     * Aggregate the ledger in SQL rather than materialising every spend entry in the JVM. The query has a
     * fixed maximum of 30 Beijing-day buckets, so a busy account cannot turn the dashboard into an unbounded
     * ledger export. Explicit UTC bounds keep the result independent from the database session timezone.
     */
    private List<DailySpend> dailySpend(Instant start, Instant end, int days) {
        StringBuilder sql = new StringBuilder("select ");
        List<Object> params = new ArrayList<>(days * 4 + 2);
        LocalDate first = start.atZone(BEIJING).toLocalDate();
        for (int i = 0; i < days; i++) {
            if (i > 0) sql.append(", ");
            Instant dayStart = first.plusDays(i).atStartOfDay(BEIJING).toInstant();
            Instant dayEnd = first.plusDays(i + 1L).atStartOfDay(BEIJING).toInstant();
            sql.append("coalesce(sum(case when created_at >= ? and created_at < ? and entry_type='SPEND' and amount < 0 then -amount else 0 end),0) wallet_")
                    .append(i)
                    .append(", coalesce(sum(case when created_at >= ? and created_at < ? and entry_type='SCOPED_SPEND' and amount < 0 then -amount else 0 end),0) grant_")
                    .append(i);
            params.add(Timestamp.from(dayStart));
            params.add(Timestamp.from(dayEnd));
            params.add(Timestamp.from(dayStart));
            params.add(Timestamp.from(dayEnd));
        }
        sql.append(" from aep_ledger_entries where created_at >= ? and created_at < ? and entry_type in ('SPEND','SCOPED_SPEND')");
        params.add(Timestamp.from(start));
        params.add(Timestamp.from(end));
        Map<String, Object> row = jdbc.queryForMap(sql.toString(), params.toArray());
        List<DailySpend> result = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            result.add(new DailySpend(first.plusDays(i).format(DateTimeFormatter.ISO_DATE),
                    number(row.get("wallet_" + i)), number(row.get("grant_" + i))));
        }
        return result;
    }

    private List<ModelSpend> modelSpend(Instant start) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select c.target_json, h.status, count(*) jobs, coalesce(sum(c.settled_payable_credits),0) settled_payable_credits, " +
                        "coalesce(sum(c.settled_scoped_credits),0) settled_scoped_credits, coalesce(sum(c.settled_wallet_credits),0) settled_wallet_credits " +
                        "from aep_model_charges c join aep_credit_holds h on h.id=c.hold_id where h.created_at >= ? group by c.target_json, h.status",
                Timestamp.from(start));
        record Mutable(String endpoint, String name, long[] n) {}
        Map<String, Mutable> grouped = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            JsonNode target = parse(text(row.get("target_json")));
            String endpoint = firstText(target, "endpointId", "providerId", "model");
            if (endpoint == null) endpoint = "unknown";
            String name = firstText(target, "providerModel", "model", "endpointId");
            if (name == null) name = endpoint;
            String resolvedName = name;
            Mutable m = grouped.computeIfAbsent(endpoint, k -> new Mutable(k, resolvedName, new long[7]));
            long jobs = number(row.get("jobs"));
            m.n()[0] += jobs;
            String status = text(row.get("status"));
            if ("COMMITTED".equals(status)) m.n()[1] += jobs;
            else if ("RELEASED".equals(status)) m.n()[2] += jobs;
            else m.n()[3] += jobs;
            m.n()[4] += number(row.get("settled_payable_credits"));
            m.n()[5] += number(row.get("settled_wallet_credits"));
            m.n()[6] += number(row.get("settled_scoped_credits"));
        }
        return grouped.values().stream().map(m -> new ModelSpend(m.endpoint(), m.name(), m.n()[0], m.n()[1],
                        m.n()[2], m.n()[3], m.n()[4], m.n()[5], m.n()[6]))
                .sorted(Comparator.comparingLong(ModelSpend::credits).reversed()).toList();
    }

    private List<FeatureSpend> featureSpend(Instant start) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select h.reference_type, r.kind, r.host_type, h.status, count(*) jobs, coalesce(sum(c.settled_payable_credits),0) credits " +
                        "from aep_credit_holds h left join aep_model_charges c on c.hold_id=h.id " +
                        "left join ip_run r on h.reference_type='ip-run' and r.id=h.reference_id " +
                        "where h.created_at >= ? group by h.reference_type, r.kind, r.host_type, h.status",
                Timestamp.from(start));
        Map<String, long[]> grouped = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String feature = feature(text(row.get("reference_type")), text(row.get("host_type")) + ":" + text(row.get("kind")));
            long[] n = grouped.computeIfAbsent(feature, ignored -> new long[5]);
            long jobs = number(row.get("jobs"));
            n[0] += jobs;
            String status = text(row.get("status"));
            if ("COMMITTED".equals(status)) n[1] += jobs; else if ("RELEASED".equals(status)) n[2] += jobs; else n[3] += jobs;
            n[4] += number(row.get("credits"));
        }
        List<String> order = List.of("出图", "视频", "对话", "导演台", "短剧", "其他");
        return order.stream().map(name -> {
            long[] n = grouped.getOrDefault(name, new long[5]);
            return new FeatureSpend(name, n[0], n[1], n[2], n[3], n[4]);
        }).toList();
    }

    static String feature(String referenceType, String runKind) {
        String ref = Optional.ofNullable(referenceType).orElse("").toLowerCase(Locale.ROOT);
        String kind = Optional.ofNullable(runKind).orElse("").toLowerCase(Locale.ROOT);
        if (ref.contains("drama") || kind.contains("drama")) return "短剧";
        if (kind.startsWith("director:") || kind.contains("director")) return "导演台";
        if (kind.contains("dialogue")) return "对话";
        if (ref.contains("video") || kind.contains("video") || kind.contains("lip-sync")) return "视频";
        if (ref.contains("image") || kind.contains("image") || kind.contains("generate")) return "出图";
        return "其他";
    }

    private Technology technology(Instant start, Instant end) {
        List<GenerationSample> samples = new ArrayList<>();
        boundedGenerationRows("select id, kind, status, stage, error_code, error_message, input_json, created_at, started_at, finished_at from ip_run where created_at >= ? and created_at < ?",
                start, end).forEach(r -> samples.add(ipSample(r)));
        boundedGenerationRows("select id, status, error_code, error_message, provider_used, model_used, external_task_id, created_at, updated_at, completed_at from material_video_job where created_at >= ? and created_at < ?",
                start, end).forEach(r -> samples.add(videoSample(r)));

        record Mutable(long[] n, List<GenerationSample> samples) {}
        record GroupKey(String mediaType, String supplier, String model) {}
        Map<GroupKey, Mutable> grouped = new LinkedHashMap<>();
        Map<String, long[]> failures = new LinkedHashMap<>();
        long platformErrors = 0, supplierErrors = 0, unknownErrors = 0, pendingReview = 0, queued = 0;
        List<Long> imageDurations = new ArrayList<>(), videoDurations = new ArrayList<>(), waits = new ArrayList<>();
        for (GenerationSample s : samples) {
            GroupKey groupKey = new GroupKey(s.mediaType, s.supplier, s.model);
            Mutable mutable = grouped.computeIfAbsent(groupKey, ignored -> new Mutable(new long[4], new ArrayList<>()));
            long[] n = mutable.n();
            mutable.samples().add(s);
            n[0]++;
            if (s.success) n[1]++; else if (s.failed) n[2]++; else n[3]++;
            if (s.queued) queued++;
            if (s.pendingReconciliation) pendingReview++;
            if (s.waitSeconds != null && s.waitSeconds >= 0) waits.add(s.waitSeconds);
            if (s.durationSeconds != null && s.durationSeconds >= 0) ("视频".equals(s.mediaType) ? videoDurations : imageDurations).add(s.durationSeconds);
            if (s.failed) {
                String category = failureCategory(s.errorCode, s.errorMessage);
                String ownership = ownership(s.errorCode, s.errorMessage);
                failures.computeIfAbsent(category + ":" + ownership, ignored -> new long[1])[0]++;
                if ("我方请求".equals(ownership)) platformErrors++; else if ("供应商".equals(ownership)) supplierErrors++; else unknownErrors++;
            }
        }
        List<GenerationModel> models = grouped.entrySet().stream().map(e -> {
            GroupKey key = e.getKey(); long[] n = e.getValue().n(); long terminal = n[1] + n[2];
            return new GenerationModel(key.model(), key.supplier(), key.mediaType(), n[0], n[1], n[2], n[3],
                    terminal == 0 ? null : (double)n[1] / terminal, "混合",
                    hourlyOutcomes(e.getValue().samples(), start, end));
        }).sorted(Comparator.comparingLong(GenerationModel::jobs).reversed()).toList();
        List<FailureReason> reasons = failures.entrySet().stream().map(e -> {
            String[] key = e.getKey().split(":", 2);
            return new FailureReason(key[0], failureLabel(key[0]), e.getValue()[0], key[1]);
        }).sorted(Comparator.comparingLong(FailureReason::count).reversed()).toList();
        Long avgWait = waits.isEmpty() ? null : Math.round(waits.stream().mapToLong(Long::longValue).average().orElse(0));
        QueueState queue = new QueueState(queued, avgWait, null, "unavailable", pendingReview,
                "并发余量尚无统一运行时采集源；平均等待只统计有 started_at 的任务，不用更新时间猜测。" );
        SupplierState supplier = new SupplierState(platformErrors, supplierErrors, unknownErrors,
                null, null, null, "unavailable");
        return new Technology(models, reasons, latency("图片", imageDurations), latency("视频", videoDurations), queue, supplier);
    }

    private List<Map<String, Object>> boundedGenerationRows(String sql, Instant start, Instant end) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql + " limit ?", Timestamp.from(start), Timestamp.from(end),
                MAX_TECH_SAMPLES_PER_SOURCE + 1);
        if (rows.size() > MAX_TECH_SAMPLES_PER_SOURCE) {
            // Never publish a silently truncated success rate or latency percentile. The frontend renders this
            // exception as a load error, which is safer than a green dashboard based on partial task rows.
            throw new IllegalStateException("技术任务样本超过安全上限，请缩短统计窗口");
        }
        return rows;
    }

    private record GenerationSample(String mediaType, String supplier, String model, boolean success, boolean failed, boolean queued,
                                    boolean pendingReconciliation, String errorCode, String errorMessage,
                                    Long durationSeconds, Long waitSeconds, Instant createdAt) {}

    private GenerationSample ipSample(Map<String, Object> r) {
        String status = text(r.get("status"));
        String kind = text(r.get("kind"));
        String media = kind.contains("video") ? "视频" : "图片";
        JsonNode input = parse(text(r.get("input_json")));
        String model = firstText(input.path("_exec"), "endpointId", "model", "providerModel");
        if (model == null) model = firstText(input, "model", "endpointId");
        if (model == null) model = "未记录模型";
        String supplier = firstText(input.path("_exec"), "providerId", "provider", "supplier");
        if (supplier == null) supplier = firstText(input, "providerId", "provider", "supplier");
        if (supplier == null) supplier = "未记录供应商";
        Instant created = instant(r.get("created_at")), started = instantOrNull(r.get("started_at")), finished = instantOrNull(r.get("finished_at"));
        String code = text(r.get("error_code"));
        return new GenerationSample(media, supplier, model, "done".equals(status), "failed".equals(status),
                "queued".equals(text(r.get("stage"))), isPendingReconciliation(code), code, masked(text(r.get("error_message"))),
                seconds(created, finished), seconds(created, started), created);
    }

    private GenerationSample videoSample(Map<String, Object> r) {
        String status = text(r.get("status"));
        String model = text(r.get("model_used"));
        if (model.isBlank()) model = text(r.get("provider_used"));
        if (model.isBlank()) model = "未记录模型";
        String supplier = text(r.get("provider_used"));
        if (supplier.isBlank()) supplier = "未记录供应商";
        Instant created = instant(r.get("created_at")), completed = instantOrNull(r.get("completed_at"));
        String code = text(r.get("error_code"));
        boolean pending = isPendingReconciliation(code) || (("submitting".equals(status) || "generating".equals(status)) && text(r.get("external_task_id")).isBlank());
        return new GenerationSample("视频", supplier, model, "succeeded".equals(status), "failed".equals(status),
                "queued".equals(status), pending, code, masked(text(r.get("error_message"))), seconds(created, completed), null, created);
    }

    /**
     * Bounded 24-hour outcome buckets for the dashboard. These describe observed task results, not service uptime.
     * Hours outside the selected query window are explicit {@code missing}; covered hours with no rows are
     * {@code no_calls}, so absent traffic can never be rendered as healthy green.
     */
    private List<HourlyOutcome> hourlyOutcomes(List<GenerationSample> samples, Instant queryStart, Instant queryEnd) {
        Instant lastHour = queryEnd.truncatedTo(java.time.temporal.ChronoUnit.HOURS);
        Instant firstHour = lastHour.minus(Duration.ofHours(23));
        List<HourlyOutcome> outcomes = new ArrayList<>(24);
        for (int i = 0; i < 24; i++) {
            Instant bucketStart = firstHour.plus(Duration.ofHours(i));
            Instant bucketEnd = bucketStart.plus(Duration.ofHours(1));
            if (bucketStart.isAfter(queryEnd) || !bucketEnd.isAfter(queryStart)) {
                outcomes.add(new HourlyOutcome(bucketStart, 0, 0, 0, "missing"));
                continue;
            }
            long succeeded = 0, failed = 0, inFlight = 0;
            for (GenerationSample sample : samples) {
                if (sample.createdAt().isBefore(bucketStart) || !sample.createdAt().isBefore(bucketEnd)) continue;
                if (sample.success()) succeeded++; else if (sample.failed()) failed++; else inFlight++;
            }
            String status = failed > 0 ? "issue"
                    : succeeded > 0 ? "ok"
                    : inFlight > 0 ? "active"
                    : "no_calls";
            outcomes.add(new HourlyOutcome(bucketStart, succeeded, failed, inFlight, status));
        }
        return outcomes;
    }

    private Latency latency(String media, List<Long> values) {
        if (values.isEmpty()) return new Latency(media, null, null, 0, "没有同时具备开始与终态时间的样本");
        values.sort(Long::compareTo);
        return new Latency(media, percentile(values, .50), percentile(values, .95), values.size(), "从任务创建到终态；P50/P95 仅统计已结束且时间字段完整的任务");
    }

    private Integrations integrations() {
        return new Integrations(
                new IntegrationState("unavailable", null, null, "发布清单位于服务器，当前没有应用内安全只读通道。", null),
                new IntegrationState("unavailable", null, null, "飞书发送/失败记录尚无持久化查询接口。", "/platform/ai-models#generation-alerts"),
                new IntegrationState("linked", null, "使用现有页面", "不在看板重复建设请求日志。", "/platform/error-logs")
        );
    }

    public DetailPage reconciliationDetails(String requestedCheck, int requestedPage, int requestedSize) {
        String check = Optional.ofNullable(requestedCheck).orElse("").toUpperCase(Locale.ROOT);
        if (!Set.of("A","B","C","D","E","F","G","H","I").contains(check)) throw new IllegalArgumentException("未知对账项");
        int page = Math.max(0, requestedPage), size = Math.min(100, Math.max(1, requestedSize)), offset = page * size;
        String from = detailFrom(check);
        long total = number(jdbc.queryForObject("select count(*) " + from, Long.class));
        List<Map<String, Object>> raw = jdbc.queryForList("select " + detailColumns(check) + " " + from + " order by " + detailOrder(check) + " limit ? offset ?", size, offset);
        List<Map<String, String>> items = raw.stream().map(this::safeRow).toList();
        return new DetailPage(check, items, page, size, total, (long)(page + 1) * size < total);
    }

    private String detailFrom(String check) {
        return switch (check) {
            case "A" -> "from aep_wallets where total_balance <> gift_balance + license_balance + recharge_balance";
            case "B" -> "from aep_wallets where gift_balance < 0 or license_balance < 0 or recharge_balance < 0 or pending_balance < 0 or total_balance < 0";
            case "C" -> "from aep_wallets w left join (select wallet_id, sum(case when entry_type='SPEND' or entry_type like 'SCOPED%' then 0 else amount end) s from aep_ledger_entries group by wallet_id) l on l.wallet_id=w.id where w.total_balance <> coalesce(l.s,0)";
            case "D" -> "from aep_wallets w left join (select wallet_id, sum(case when entry_type='FREEZE' then -amount when entry_type='UNFREEZE' then -amount when entry_type='SPEND' then amount else 0 end) p from aep_ledger_entries group by wallet_id) l on l.wallet_id=w.id where w.pending_balance <> coalesce(l.p,0)";
            case "E" -> "from aep_credit_grants where amount <> available + frozen + spent + expired";
            case "F" -> "from aep_credit_grants where available < 0 or frozen < 0 or spent < 0 or expired < 0";
            case "G" -> "from aep_credit_holds where status in ('COMMITTED','RELEASED') and remaining_amount <> 0";
            case "H" -> "from aep_model_charges where settled_payable_credits is not null and settled_payable_credits <> coalesce(settled_scoped_credits,0) + coalesce(settled_wallet_credits,0)";
            case "I" -> "from aep_credit_campaigns where issued > total_issue_limit";
            default -> throw new IllegalArgumentException("未知对账项");
        };
    }

    private String detailColumns(String check) {
        return switch (check) {
            case "A", "B" -> "id wallet_id, coalesce(user_id,member_user_id) user_id, total_balance, gift_balance, license_balance, recharge_balance, pending_balance";
            case "C" -> "w.id wallet_id, coalesce(w.user_id,w.member_user_id) user_id, w.total_balance, coalesce(l.s,0) ledger_total";
            case "D" -> "w.id wallet_id, coalesce(w.user_id,w.member_user_id) user_id, w.pending_balance, coalesce(l.p,0) ledger_pending";
            case "E", "F" -> "id grant_id, wallet_id, amount, available, frozen, spent, expired";
            case "G" -> "id hold_id, wallet_id, reference_type, reference_id, status, remaining_amount, created_at";
            case "H" -> "hold_id, settled_payable_credits, settled_scoped_credits, settled_wallet_credits, created_at";
            case "I" -> "id campaign_id, name, issued, total_issue_limit, expires_at";
            default -> throw new IllegalArgumentException("未知对账项");
        };
    }

    private String detailOrder(String check) {
        return switch (check) { case "G", "H" -> "created_at desc"; default -> "1"; };
    }

    public CreditEventPage creditEvents(int requestedDays, String requestedType, String query, int requestedPage, int requestedSize) {
        int days = allowedDays(requestedDays), page = Math.max(0, requestedPage), size = Math.min(100, Math.max(1, requestedSize));
        Instant end = Instant.now(), start = end.atZone(BEIJING).toLocalDate().minusDays(days - 1L).atStartOfDay(BEIJING).toInstant();
        String type = requestedType == null ? "" : requestedType.toUpperCase(Locale.ROOT);
        if (!type.isBlank() && !ISSUE_TYPES.contains(type)) throw new IllegalArgumentException("未知积分类型");
        StringBuilder where = new StringBuilder(" from aep_ledger_entries where created_at >= ? and created_at < ? and entry_type in (");
        where.append(String.join(",", Collections.nCopies(ISSUE_TYPES.size(), "?"))).append(")");
        List<Object> params = new ArrayList<>(); params.add(Timestamp.from(start)); params.add(Timestamp.from(end)); params.addAll(ISSUE_TYPES);
        if (!type.isBlank()) { where.append(" and entry_type = ?"); params.add(type); }
        String q = Optional.ofNullable(query).orElse("").trim().toLowerCase(Locale.ROOT);
        if (!q.isBlank()) { where.append(" and (lower(coalesce(actor_user_id,'')) like ? or lower(coalesce(user_id,'')) like ? or lower(coalesce(description,'')) like ?)"); String like = "%" + q + "%"; params.add(like); params.add(like); params.add(like); }
        long total = number(jdbc.queryForObject("select count(*)" + where, Long.class, params.toArray()));
        List<Object> pageParams = new ArrayList<>(params); pageParams.add(size); pageParams.add(page * size);
        List<CreditEvent> items = jdbc.query("select id, entry_type, actor_user_id, user_id, amount, description, created_at" + where + " order by created_at desc limit ? offset ?",
                (rs, n) -> new CreditEvent(rs.getString("id"), rs.getString("entry_type"), masked(rs.getString("actor_user_id")),
                        masked(rs.getString("user_id")), rs.getLong("amount"), yuan(rs.getLong("amount")),
                        masked(rs.getString("description")), rs.getTimestamp("created_at").toInstant()), pageParams.toArray());
        return new CreditEventPage(items, page, size, total, (long)(page + 1) * size < total);
    }

    private Map<String, String> safeRow(Map<String, Object> row) {
        Map<String, String> safe = new LinkedHashMap<>();
        row.forEach((key, value) -> safe.put(key.toLowerCase(Locale.ROOT), masked(value == null ? "—" : String.valueOf(value))));
        return safe;
    }

    static String masked(String value) {
        if (value == null) return "—";
        return PHONE.matcher(value).replaceAll("$1****$2");
    }

    static String failureCategory(String code, String message) {
        String value = (Optional.ofNullable(code).orElse("") + " " + Optional.ofNullable(message).orElse("")).toUpperCase(Locale.ROOT);
        if (value.contains("TIMEOUT") || value.contains("超时")) return "timeout";
        if (value.contains("MODERATION") || value.contains("SAFETY") || value.contains("CONTENT") || value.contains("审核")) return "moderation";
        if (value.contains("NO_TASK") || value.contains("SUBMISSION_UNKNOWN") || value.contains("TASK_ID") || value.contains("任务号")) return "no-task-id";
        if (value.contains("REJECT") || value.contains("REFUSED") || value.contains("拒绝")) return "rejected";
        return "other";
    }

    static String ownership(String code, String message) {
        String value = (Optional.ofNullable(code).orElse("") + " " + Optional.ofNullable(message).orElse("")).toUpperCase(Locale.ROOT);
        if (value.contains("INVALID") || value.contains("PRICE_NOT_CONFIGURED") || value.contains("VALIDATION") || value.contains("BAD_REQUEST")) return "我方请求";
        if (value.contains("PROVIDER") || value.contains("VENDOR") || value.contains("UPSTREAM") || value.contains("RATE_LIMIT") || value.contains("TIMEOUT") || value.contains("供应商") || value.contains("厂商")) return "供应商";
        return "未知";
    }

    private String failureLabel(String category) {
        return switch (category) { case "timeout" -> "超时"; case "moderation" -> "内容审核"; case "no-task-id" -> "无任务号 / 受理待核对"; case "rejected" -> "供应商拒绝"; default -> "其他 / 未知"; };
    }

    private boolean isPendingReconciliation(String code) {
        String v = Optional.ofNullable(code).orElse("").toUpperCase(Locale.ROOT);
        return v.contains("SUBMISSION_UNKNOWN") || v.contains("USAGE_PENDING") || v.contains("RECOVERING");
    }

    private long percentile(List<Long> values, double p) {
        int index = (int)Math.ceil(p * values.size()) - 1;
        return values.get(Math.max(0, Math.min(values.size() - 1, index)));
    }

    private Long seconds(Instant start, Instant end) { return start == null || end == null ? null : Math.max(0, Duration.between(start, end).getSeconds()); }
    private double yuan(long credits) { return Math.round((credits / 100.0) * 100.0) / 100.0; }
    private int allowedDays(int days) { return days == 1 || days == 7 || days == 30 ? days : 7; }
    private long count(String sql, Object... args) { return number(jdbc.queryForObject(sql, Long.class, args)); }
    private long number(Object value) { return value instanceof Number n ? n.longValue() : value == null ? 0 : Long.parseLong(String.valueOf(value)); }
    private String text(Object value) { return value == null ? "" : String.valueOf(value); }
    private Instant instantOrNull(Object value) { return value == null ? null : instant(value); }
    private Instant instant(Object value) {
        if (value instanceof Instant i) return i;
        if (value instanceof Timestamp t) return t.toInstant();
        if (value instanceof OffsetDateTime o) return o.toInstant();
        if (value instanceof LocalDateTime l) return l.atZone(ZoneOffset.UTC).toInstant();
        return Instant.parse(String.valueOf(value));
    }
    private JsonNode parse(String value) { try { return value == null || value.isBlank() ? json.createObjectNode() : json.readTree(value); } catch (Exception ignored) { return json.createObjectNode(); } }
    private String firstText(JsonNode node, String... keys) { for (String key : keys) { JsonNode value = node.path(key); if (value.isTextual() && !value.asText().isBlank()) return value.asText(); } return null; }
}
