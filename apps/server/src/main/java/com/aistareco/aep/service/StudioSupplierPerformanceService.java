package com.aistareco.aep.service;

import com.aistareco.aep.dto.StudioSupplierPerformanceDto;
import com.aistareco.aep.dto.StudioSupplierPerformanceDto.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Supplier quality query with an explicit range limit. Statistics and detail rows share one filtered sample set. */
@Service
@Transactional(readOnly = true, timeout = 12)
public class StudioSupplierPerformanceService {
    static final int MAX_RANGE_DAYS = 31;
    static final int MAX_ROWS_PER_SOURCE = 50_000;
    private static final Set<String> TIMEZONES = Set.of("Asia/Shanghai", "America/Los_Angeles", "UTC");
    private static final Set<String> MEDIA = Set.of("all", "image", "video");
    private static final Set<String> STATUSES = Set.of("all", "succeeded", "failed", "in-flight", "cancelled", "unknown");
    private static final Set<String> ERROR_CATEGORIES = Set.of("moderation", "insufficient-balance", "rate-limited", "http-error", "result-validation", "timeout", "submission-unknown", "rejected", "other");
    private static final Pattern PHONE = Pattern.compile("(?<!\\d)(1\\d{2})\\d{4}(\\d{4})(?!\\d)");

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public StudioSupplierPerformanceService(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public StudioSupplierPerformanceDto query(String fromLocal, String toLocal, String requestedTimezone,
                                               String supplier, String model, String mediaType, String status,
                                               List<String> excluded, String search, int requestedPage, int requestedSize) {
        ZoneId zone = zone(requestedTimezone);
        Instant end = parseLocal(toLocal, zone, ZonedDateTime.now(zone).toLocalDateTime());
        Instant start = parseLocal(fromLocal, zone, end.atZone(zone).minusHours(24).toLocalDateTime());
        if (!start.isBefore(end)) throw new IllegalArgumentException("开始时间必须早于结束时间");
        if (start.atZone(zone).plusDays(MAX_RANGE_DAYS).toInstant().isBefore(end)) {
            throw new IllegalArgumentException("查询范围最多 31 天，请缩短时间范围");
        }
        String media = allowed(normal(mediaType), MEDIA, "all", "未知任务类型");
        String taskStatus = allowed(normal(status), STATUSES, "all", "未知任务状态");
        Set<String> excludedCategories = parseExclusions(excluded);

        List<Sample> all = load(start, end);
        String supplierFilter = safeFilter(supplier), modelFilter = safeFilter(model), q = safeFilter(search);
        List<String> supplierOptions = all.stream().map(Sample::supplier).filter(v -> !v.equals("未记录供应商")).distinct().sorted().toList();
        List<String> modelOptions = all.stream().map(Sample::model).filter(v -> !v.equals("未记录模型")).distinct().sorted().toList();
        List<Sample> beforeExclusion = all.stream().filter(s -> matches(s, supplierFilter, modelFilter, media, taskStatus, q)).toList();
        List<Sample> filtered = beforeExclusion.stream().filter(s -> !excludedCategories.contains(s.failureCategory)).toList();
        long succeeded = count(filtered, "succeeded"), failed = count(filtered, "failed");
        long inFlight = count(filtered, "in-flight"), cancelled = count(filtered, "cancelled"), unknown = count(filtered, "unknown");
        long terminal = succeeded + failed;
        List<Long> durations = filtered.stream().filter(s -> s.status.equals("succeeded") && s.durationSeconds != null).map(Sample::durationSeconds).sorted().toList();
        Summary summary = new Summary(filtered.size(), succeeded, failed, inFlight, cancelled, unknown, terminal,
                terminal == 0 ? null : (double) succeeded / terminal,
                percentile(durations, .50), percentile(durations, .95), durations.isEmpty() ? null : durations.get(durations.size() - 1),
                durations.size(), beforeExclusion.size() - filtered.size(),
                "仅统计交付成功且时间字段完整的任务；从创建到交付，包含排队、生成、下载与转存。", terminal < 20);
        String bucket = Duration.between(start, end).compareTo(Duration.ofHours(48)) <= 0 ? "hour" : "day";
        List<TrendPoint> trend = trend(filtered, start, end, zone, bucket);
        List<LatencyBucket> distribution = latencyDistribution(durations);
        List<ErrorSlice> errors = errorDistribution(filtered, failed);
        int page = Math.max(0, requestedPage), size = Math.min(100, Math.max(1, requestedSize));
        List<Sample> ordered = filtered.stream().sorted(Comparator.comparing(Sample::createdAt).reversed()).toList();
        int from = Math.min(ordered.size(), page * size), to = Math.min(ordered.size(), from + size);
        List<TaskDetail> items = ordered.subList(from, to).stream().map(this::detail).toList();
        return new StudioSupplierPerformanceDto(Instant.now(), zone.getId(), new Window(start, end, bucket, MAX_RANGE_DAYS),
                new Filters(supplierFilter, modelFilter, media, taskStatus, List.copyOf(excludedCategories), q),
                summary, trend, distribution, errors, supplierOptions, modelOptions,
                new DetailPage(items, page, size, ordered.size(), to < ordered.size()));
    }

    private Set<String> parseExclusions(List<String> excluded) {
        Set<String> result = new LinkedHashSet<>();
        if (excluded == null) return result;
        for (String item : excluded) for (String part : Objects.toString(item, "").split(",")) {
            String value = normal(part);
            if (!value.isBlank() && !ERROR_CATEGORIES.contains(value)) throw new IllegalArgumentException("未知排除项");
            if (!value.isBlank()) result.add(value);
        }
        return result;
    }

    private List<Sample> load(Instant start, Instant end) {
        List<Sample> rows = new ArrayList<>();
        bounded("select id, kind, status, stage, error_code, error_message, input_json, created_at, started_at, finished_at from ip_run where created_at >= ? and created_at < ?", start, end)
                .forEach(row -> rows.add(ipSample(row)));
        bounded("select id, status, error_code, error_message, provider_used, model_used, created_at, completed_at from material_video_job where created_at >= ? and created_at < ?", start, end)
                .forEach(row -> rows.add(videoSample(row)));
        return rows;
    }

    private List<Map<String, Object>> bounded(String sql, Instant start, Instant end) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql + " limit ?", Timestamp.from(start), Timestamp.from(end), MAX_ROWS_PER_SOURCE + 1);
        if (rows.size() > MAX_ROWS_PER_SOURCE) throw new IllegalStateException("供应商任务样本超过安全上限，请缩短统计窗口");
        return rows;
    }

    private Sample ipSample(Map<String, Object> row) {
        JsonNode input = parse(text(row.get("input_json"))), exec = input.path("_exec");
        String endpoint = first(exec, "endpointId", "providerId");
        String provider = first(exec, "providerId", "provider", "supplier");
        if (provider == null) provider = first(input, "providerId", "provider", "supplier");
        String model = first(exec, "providerModel", "model", "endpointId");
        if (model == null) model = first(input, "model", "endpointId");
        if (provider == null) provider = endpoint;
        String raw = normal(text(row.get("status")));
        String status = switch (raw) {
            case "done" -> "succeeded";
            case "failed" -> "failed";
            case "running" -> "in-flight";
            default -> "unknown";
        };
        String code = text(row.get("error_code"));
        ErrorInfo error = classify(code, text(row.get("error_message")));
        Instant created = instant(row.get("created_at")), completed = instantOrNull(row.get("finished_at"));
        String kind = normal(text(row.get("kind")));
        return new Sample(safeText(text(row.get("id")), 96), "ip_run",
                safeText(fallback(provider, "未记录供应商"), 128), safeText(fallback(model, "未记录模型"), 128),
                kind.contains("video") ? "video" : "image", status, error.category, error.label, error.ownership,
                safeCode(code), created, completed, "succeeded".equals(status) ? seconds(created, completed) : null);
    }

    private Sample videoSample(Map<String, Object> row) {
        String raw = normal(text(row.get("status")));
        String status = switch (raw) {
            case "succeeded" -> "succeeded";
            case "failed" -> "failed";
            case "queued", "submitting", "generating" -> "in-flight";
            case "cancelled", "canceled" -> "cancelled";
            default -> "unknown";
        };
        String code = text(row.get("error_code"));
        ErrorInfo error = classify(code, text(row.get("error_message")));
        Instant created = instant(row.get("created_at")), completed = instantOrNull(row.get("completed_at"));
        return new Sample(safeText(text(row.get("id")), 96), "material_video_job",
                safeText(fallback(text(row.get("provider_used")), "未记录供应商"), 128),
                safeText(fallback(text(row.get("model_used")), "未记录模型"), 128),
                "video", status, error.category, error.label, error.ownership, safeCode(code),
                created, completed, "succeeded".equals(status) ? seconds(created, completed) : null);
    }

    static ErrorInfo classify(String code, String message) {
        String value = (Objects.toString(code, "") + " " + Objects.toString(message, "")).toUpperCase(Locale.ROOT);
        if (value.isBlank()) return new ErrorInfo("other", "其他 / 未知", "未知");
        if (contains(value, "INSUFFICIENT", "BALANCE", "CREDITS", "积分不足", "余额不足")) return new ErrorInfo("insufficient-balance", "余额 / 积分不足", "我方账户");
        if (contains(value, "MODERATION", "SAFETY", "CONTENT_POLICY", "审核")) return new ErrorInfo("moderation", "内容审核拒绝", "供应商");
        if (contains(value, "RATE_LIMIT", "TOO_MANY_REQUESTS", "429", "限流")) return new ErrorInfo("rate-limited", "限流", "供应商");
        if (contains(value, "TIMEOUT", "超时")) return new ErrorInfo("timeout", "超时", "供应商");
        if (contains(value, "SUBMISSION_UNKNOWN", "NO_TASK", "TASK_ID", "任务号", "受理")) return new ErrorInfo("submission-unknown", "受理结果 / 任务号待核对", "未知");
        if (contains(value, "SIZE", "VALIDATION", "OUTPUT_INVALID", "MISMATCH", "字段异常", "尺寸")) return new ErrorInfo("result-validation", "结果字段 / 规格校验失败", "未知");
        if (contains(value, "HTTP", "502", "503", "504", "UPSTREAM")) return new ErrorInfo("http-error", "上游 HTTP 异常", "供应商");
        if (contains(value, "REJECT", "REFUSED", "拒绝")) return new ErrorInfo("rejected", "供应商拒绝", "供应商");
        return new ErrorInfo("other", "其他 / 未知", "未知");
    }

    private boolean matches(Sample sample, String supplier, String model, String media, String status, String query) {
        return (supplier.isBlank() || sample.supplier.equalsIgnoreCase(supplier))
                && (model.isBlank() || sample.model.equalsIgnoreCase(model))
                && (media.equals("all") || sample.mediaType.equals(media))
                && (status.equals("all") || sample.status.equals(status))
                && (query.isBlank() || (sample.id + " " + sample.supplier + " " + sample.model + " "
                + sample.errorCode + " " + sample.failureCategory + " " + sample.failureLabel)
                .toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT)));
    }

    private List<TrendPoint> trend(List<Sample> samples, Instant start, Instant end, ZoneId zone, String bucket) {
        List<TrendPoint> result = new ArrayList<>();
        ZonedDateTime cursor = start.atZone(zone).truncatedTo(ChronoUnit.HOURS);
        if (bucket.equals("day")) cursor = cursor.toLocalDate().atStartOfDay(zone);
        while (cursor.toInstant().isBefore(end)) {
            ZonedDateTime next = bucket.equals("hour") ? cursor.plusHours(1) : cursor.plusDays(1);
            Instant a = cursor.toInstant(), b = next.toInstant();
            List<Sample> group = samples.stream().filter(sample -> !sample.createdAt.isBefore(a) && sample.createdAt.isBefore(b)).toList();
            long ok = count(group, "succeeded"), bad = count(group, "failed"), terminal = ok + bad;
            result.add(new TrendPoint(a, ok, bad, count(group, "in-flight"), count(group, "cancelled"),
                    count(group, "unknown"), terminal == 0 ? null : (double) ok / terminal));
            cursor = next;
        }
        return result;
    }

    private List<LatencyBucket> latencyDistribution(List<Long> values) {
        long[] counts = new long[6];
        for (long value : values) counts[value <= 60 ? 0 : value <= 180 ? 1 : value <= 300 ? 2 : value <= 600 ? 3 : value <= 900 ? 4 : 5]++;
        String[] keys = {"lte-60", "61-180", "181-300", "301-600", "601-900", "gt-900"};
        String[] labels = {"≤ 1 分钟", "1–3 分钟", "3–5 分钟", "5–10 分钟", "10–15 分钟", "> 15 分钟"};
        List<LatencyBucket> result = new ArrayList<>();
        for (int index = 0; index < counts.length; index++) {
            result.add(new LatencyBucket(keys[index], labels[index], counts[index],
                    values.isEmpty() ? 0 : (double) counts[index] / values.size()));
        }
        return result;
    }

    private List<ErrorSlice> errorDistribution(List<Sample> samples, long failedTotal) {
        return samples.stream().filter(sample -> sample.status.equals("failed"))
                .collect(Collectors.groupingBy(
                        sample -> sample.failureCategory + "\u0000" + sample.failureLabel + "\u0000" + sample.ownership,
                        LinkedHashMap::new, Collectors.counting()))
                .entrySet().stream().map(entry -> {
                    String[] key = entry.getKey().split("\\u0000", -1);
                    return new ErrorSlice(key[0], key[1], key[2], entry.getValue(),
                            failedTotal == 0 ? 0 : (double) entry.getValue() / failedTotal);
                }).sorted(Comparator.comparingLong(ErrorSlice::count).reversed()).toList();
    }

    private TaskDetail detail(Sample sample) {
        return new TaskDetail(sample.id, sample.source, sample.supplier, sample.model, sample.mediaType,
                sample.status, sample.failureCategory, sample.failureLabel, sample.ownership,
                sample.errorCode, sample.createdAt, sample.completedAt, sample.durationSeconds);
    }
    private long count(List<Sample> samples, String status) { return samples.stream().filter(sample -> sample.status.equals(status)).count(); }
    private Long percentile(List<Long> sorted, double percentile) {
        if (sorted.isEmpty()) return null;
        int index = (int) Math.ceil(percentile * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(sorted.size() - 1, index)));
    }
    private ZoneId zone(String value) {
        String id = value == null || value.isBlank() ? "Asia/Shanghai" : value;
        if (!TIMEZONES.contains(id)) throw new IllegalArgumentException("不支持的时区");
        return ZoneId.of(id);
    }
    private Instant parseLocal(String value, ZoneId zone, LocalDateTime fallback) {
        try { return (value == null || value.isBlank() ? fallback : LocalDateTime.parse(value)).atZone(zone).toInstant(); }
        catch (DateTimeParseException exception) { throw new IllegalArgumentException("时间格式无效"); }
    }
    private String allowed(String value, Set<String> allowed, String fallback, String error) {
        String normalized = value.isBlank() ? fallback : value;
        if (!allowed.contains(normalized)) throw new IllegalArgumentException(error);
        return normalized;
    }
    private String safeFilter(String value) {
        String result = Objects.toString(value, "").trim();
        if (result.length() > 128) throw new IllegalArgumentException("筛选条件过长");
        return result;
    }

    private String safeCode(String value) {
        String result = PHONE.matcher(Objects.toString(value, "")).replaceAll("$1****$2");
        return result.length() > 80 ? result.substring(0, 80) : result;
    }
    private String safeText(String value, int maxLength) {
        String result = PHONE.matcher(Objects.toString(value, "")).replaceAll("$1****$2");
        return result.length() > maxLength ? result.substring(0, maxLength) : result;
    }
    private JsonNode parse(String value) {
        try { return value == null || value.isBlank() ? json.createObjectNode() : json.readTree(value); }
        catch (Exception ignored) { return json.createObjectNode(); }
    }
    private String first(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode value = node.path(key);
            if (value.isTextual() && !value.asText().isBlank()) return value.asText();
        }
        return null;
    }
    private String fallback(String value, String fallback) { return value == null || value.isBlank() ? fallback : value; }
    private String normal(String value) { return Objects.toString(value, "").trim().toLowerCase(Locale.ROOT); }
    private String text(Object value) { return value == null ? "" : String.valueOf(value); }
    private Instant instantOrNull(Object value) { return value == null ? null : instant(value); }
    private Instant instant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof OffsetDateTime offset) return offset.toInstant();
        if (value instanceof LocalDateTime local) return local.toInstant(ZoneOffset.UTC);
        return Instant.parse(String.valueOf(value));
    }
    private Long seconds(Instant start, Instant end) { return start == null || end == null ? null : Math.max(0, Duration.between(start, end).getSeconds()); }
    private static boolean contains(String value, String... terms) {
        for (String term : terms) if (value.contains(term)) return true;
        return false;
    }

    record ErrorInfo(String category, String label, String ownership) {}
    private record Sample(String id, String source, String supplier, String model, String mediaType,
                          String status, String failureCategory, String failureLabel, String ownership,
                          String errorCode, Instant createdAt, Instant completedAt, Long durationSeconds) {}
}
