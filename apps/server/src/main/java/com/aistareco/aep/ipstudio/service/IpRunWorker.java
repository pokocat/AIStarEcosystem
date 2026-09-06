package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapImageInput;
import com.aistareco.aep.dap.service.DapMultimodalClient;
import com.aistareco.aep.dap.service.DapMultimodalClient.DapModelException;
import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 异步执行一次运行。
 *
 * <p>计费纪律（{@code DramaReferenceAssetService.generateReferenceSheet} 范式）：
 * <ol>
 *   <li>hold 已由 {@link IpRunService} 在派发前整批冻结；</li>
 *   <li>每张图 **先 {@code commitHold(单价)}、再把候选写进 output** —— 顺序反了就会出现
 *       「commitHold 抛错（内部已释放）但图已入库」的白送；</li>
 *   <li>首张失败即停，剩余额度 {@code releaseHold}；零成功 → failed + 原始 errorCode；</li>
 *   <li>{@code catch (RuntimeException)} 而不是只抓 BusinessException ——
 *       {@code commitHold} 抛的是 {@code ResponseStatusException}，只抓 BusinessException
 *       会跳过释放，把冻结额挂到 CreditHoldSweeper（默认 180 分钟）才回来。</li>
 * </ol>
 *
 * <p>绝不产假产物：拿不到图 / 引擎不支持看图 一律 failed + errorCode（§8.0）。
 */
@Service
public class IpRunWorker {

    private static final Logger log = LoggerFactory.getLogger(IpRunWorker.class);

    private final IpRunRepository runRepo;
    private final IpProjectService projects;
    private final DapMultimodalClient multimodal;
    private final DapImageInput imageInput;
    private final DapPricingService pricing;
    private final FileStorageService storage;
    private final CreditService credits;
    private final ObjectMapper om;

    public IpRunWorker(IpRunRepository runRepo,
                       IpProjectService projects,
                       DapMultimodalClient multimodal,
                       DapImageInput imageInput,
                       DapPricingService pricing,
                       FileStorageService storage,
                       CreditService credits,
                       ObjectMapper om) {
        this.runRepo = runRepo;
        this.projects = projects;
        this.multimodal = multimodal;
        this.imageInput = imageInput;
        this.pricing = pricing;
        this.storage = storage;
        this.credits = credits;
        this.om = om;
    }

    @Async("ipRunExecutor")
    public void execute(String runId) {
        runBlocking(runId);
    }

    /** 同步入口（测试与 reaper 补跑用；@Async 只是它的包装）。 */
    public void runBlocking(String runId) {
        IpRun run = runRepo.findById(runId).orElse(null);
        if (run == null) {
            log.warn("[ipstudio] worker 找不到运行 run={}", runId);
            return;
        }
        if (!IpRun.STATUS_RUNNING.equals(run.getStatus())) return;
        run.setStartedAt(Instant.now());
        progress(run, 8, "prompt.compile");
        try {
            if (IpRun.KIND_IDENTITY.equals(run.getKind())) {
                runIdentity(run);
            } else {
                runGenerate(run);
            }
        } catch (RuntimeException e) {
            // 兜底：任何漏网异常都要让冻结回去，不能让用户的钱卡在 pending 桶里
            log.warn("[ipstudio] 运行异常 run={} err={}", runId, e.toString());
            release(run, "IP 运行失败 · 释放冻结");
            failWithoutSpend(run, codeOf(e), friendly(e));
        }
    }

    // ── identity：带图 chat 抽取人物特征卡 ────────────────────

    private void runIdentity(IpRun run) {
        JsonNode inputs = projects.parseOrEmptyObject(run.getInputJson());
        JsonNode exec = inputs.path("_exec");
        String sourceKey = exec.path("sourceKey").asText(null);
        long unit = unitCostOf(exec, pricing.ipIdentity());
        long holdTotal = exec.path("holdTotal").asLong(unit);

        if (isCancelRequested(run)) {
            release(run, "IP 特征卡 · 已取消，释放冻结");
            failWithoutSpend(run, "IP_RUN_CANCELLED", "已取消");
            return;
        }

        progress(run, 20, "identity.extract");
        String image = sourceKey == null ? null : imageInput.of(sourceKey);
        if (image == null) {
            release(run, "IP 特征卡 · 照片不可读，释放冻结");
            failWithoutSpend(run, "IP_NODE_INPUT_MISSING", "读取不到照片，请重新上传后再抽取");
            return;
        }

        JsonNode parsed;
        try {
            parsed = multimodal.chatJsonWithImages(
                    exec.path("system").asText(""), exec.path("user").asText(""), List.of(image));
        } catch (RuntimeException e) {
            release(run, "IP 特征卡 · 抽取失败，释放冻结");
            failWithoutSpend(run, "IP_IDENTITY_EXTRACT_FAILED",
                    "看图抽取特征卡失败：当前形象引擎可能不支持图片输入。"
                            + "请在后台给「数字人 · 人设」用途绑定支持看图的模型，或手动填写特征卡");
            return;
        }

        String text = textOf(parsed, "text");
        String promptEn = textOf(parsed, "promptEn");
        if (text == null && promptEn == null) {
            release(run, "IP 特征卡 · 输出不可用，释放冻结");
            failWithoutSpend(run, "IP_IDENTITY_EXTRACT_FAILED", "抽取结果为空，请重试或手动填写特征卡");
            return;
        }

        // 模型已经算完了才发现用户点了取消：这时候还没扣款，就别扣了，整笔退回
        if (isCancelRequested(run)) {
            release(run, "IP 特征卡 · 已取消，释放冻结");
            failWithoutSpend(run, "IP_RUN_CANCELLED", "已取消");
            return;
        }

        // 先扣款，再落产物（顺序见类注释）；单价只认 hold 时的快照
        if (unit > 0) {
            credits.commitHold(IpRunService.REF_TYPE, run.getId(), unit, "IP 人物特征卡抽取");
        }
        if (holdTotal > unit) release(run, "IP 特征卡 · 冻结额有余，释放剩余");
        ObjectNode out = om.createObjectNode();
        if (text != null) out.put("text", text);
        if (promptEn != null) out.put("promptEn", promptEn);
        run.setOutputJson(write(out));
        run.setCost(unit);
        finish(run);
    }

    // ── generate：逐张出图 ───────────────────────────────────

    private void runGenerate(IpRun run) {
        JsonNode inputs = projects.parseOrEmptyObject(run.getInputJson());
        JsonNode exec = inputs.path("_exec");
        String prompt = inputs.path("prompt").asText("");
        String size = inputs.path("size").asText("768x1024");
        int count = Math.max(1, inputs.path("count").asInt(1));
        long unit = unitCostOf(exec, pricing.ipImage());
        long holdTotal = exec.path("holdTotal").asLong(unit * count);

        // 参考图必须在第一次出图**之前**全部物化。
        // 以前是边循环边 of(key)、读不到就静默丢掉：主图 / 原照片读不到时，
        // inputs.refs 里已经写着 applied=true，用户界面显示「身份已锁定」，
        // 实际却按纯文生图出了一张不像自己的脸，还照价扣满。
        List<String> refs;
        try {
            refs = materializeRefs(run, inputs, exec);
        } catch (UnreadableIdentityRefException e) {
            release(run, "IP 出图 · 身份参考图不可读，释放冻结");
            failWithoutSpend(run, "IP_REF_UNREADABLE", e.getMessage());
            return;
        }

        ArrayNode candidates = om.createArrayNode();
        int committed = 0;
        RuntimeException lastErr = null;
        boolean cancelled = false;

        for (int i = 0; i < count; i++) {
            if (isCancelRequested(run)) { cancelled = true; break; }
            progress(run, 10 + (int) Math.round(80.0 * i / count), "image.generate." + (i + 1));
            try {
                byte[] bytes = multimodal.generateImage(prompt, size, refs.isEmpty() ? null : refs);
                requireDecodableImage(bytes);
                progress(run, 10 + (int) Math.round(80.0 * (i + 1) / count), "storage.persist");
                FileStorageService.StoredFile stored = storage.store(
                        bytes, IpProjectService.CATEGORY_GEN, run.getOwnerUserId(), "png", "image/png");
                if (unit > 0) {
                    credits.commitHold(IpRunService.REF_TYPE, run.getId(), unit,
                            "IP 形象出图 · 第 " + (i + 1) + " 张");
                }
                // commit 成功之后才承认这张图
                candidates.addObject().put("key", stored.key());
                committed++;
                ObjectNode partial = om.createObjectNode();
                partial.set("candidates", candidates.deepCopy());
                run.setOutputJson(write(partial));
                run.setCost(unit * committed);
                runRepo.save(run);
            } catch (RuntimeException e) {
                lastErr = e;
                break;
            }
        }

        // 按**金额**判断有没有剩余（而不是张数）：单价快照与 hold 总额都来自同一份 _exec，
        // 少扣一分都要退回去，绝不把冻结额留给三小时后的 CreditHoldSweeper。
        if (unit * committed < holdTotal) {
            release(run, cancelled ? "IP 出图 · 已取消，释放剩余冻结" : "IP 出图 · 剩余释放");
        }
        run.setCost(unit * committed);
        if (committed == 0) {
            if (cancelled) {
                fail(run, "IP_RUN_CANCELLED", "已取消");
            } else {
                fail(run, codeOf(lastErr), friendly(lastErr));
            }
            return;
        }
        ObjectNode out = om.createObjectNode();
        out.set("candidates", candidates);
        run.setOutputJson(write(out));
        if (cancelled) {
            // 已出的图归用户，但这次运行不是完整的 —— 如实标成失败态并说明原因
            fail(run, "IP_RUN_CANCELLED", "已取消（已生成的 " + committed + " 张仍可使用）");
        } else if (lastErr != null) {
            fail(run, codeOf(lastErr), friendly(lastErr) + "（已生成 " + committed + " 张）");
        } else {
            finish(run);
        }
    }

    // ── 参考图物化 ────────────────────────────────────────────

    /** 身份锚（主形象图 / 原照片）读不到 —— 这一单必须失败退款，不许降级成文生图。 */
    private static final class UnreadableIdentityRefException extends RuntimeException {
        UnreadableIdentityRefException(String message) { super(message); }
    }

    /**
     * 把 {@code _exec.refKeys} 变成模型可消费的图片输入。
     *
     * <ul>
     *   <li>{@code master} / {@code source} 读不到 → 抛 {@link UnreadableIdentityRefException}，
     *       调用方退款并以 {@code IP_REF_UNREADABLE} 失败（少一张身份锚出来的就不是同一个人）；</li>
     *   <li>可选的 {@code reference} 读不到 → 把库里那一条改成 {@code applied=false, reason=unreadable}
     *       后继续 —— 界面必须看得见「这张局部参考没生效」，不能嘴上 applied=true 手上没带。</li>
     * </ul>
     */
    private List<String> materializeRefs(IpRun run, JsonNode inputs, JsonNode exec) {
        List<String> out = new ArrayList<>();
        JsonNode refKeys = exec.path("refKeys");
        if (!refKeys.isArray()) return out;
        boolean changed = false;
        for (JsonNode entry : refKeys) {
            // 老结构（纯字符串数组）按可选参考处理：没有 role 就不该拿它当身份锚硬失败
            String key = entry.isTextual() ? entry.asText(null) : entry.path("key").asText(null);
            String role = entry.isTextual() ? "reference" : entry.path("role").asText("reference");
            int refIndex = entry.isTextual() ? -1 : entry.path("refIndex").asInt(-1);
            String in = key == null ? null : imageInput.of(key);
            if (in != null) {
                out.add(in);
                continue;
            }
            if ("master".equals(role) || "source".equals(role)) {
                throw new UnreadableIdentityRefException("master".equals(role)
                        ? "读取不到主形象图，无法锁定同一个人的样貌；已退回冻结积分，请重新生成主形象并选图"
                        : "读取不到原照片，无法锁定同一个人的样貌；已退回冻结积分，请重新上传照片");
            }
            changed |= markRefUnapplied(inputs, refIndex, role);
        }
        if (changed) {
            run.setInputJson(write(inputs));
            runRepo.save(run);
        }
        return out;
    }

    /** 把 inputs.refs[refIndex] 标成未生效；refIndex 缺失时退化为按 role 找第一条 applied=true 的。 */
    private boolean markRefUnapplied(JsonNode inputs, int refIndex, String role) {
        JsonNode arr = inputs.path("refs");
        if (!arr.isArray()) return false;
        ObjectNode target = null;
        if (refIndex >= 0 && refIndex < arr.size() && arr.get(refIndex).isObject()) {
            target = (ObjectNode) arr.get(refIndex);
        } else {
            for (JsonNode n : arr) {
                if (n.isObject() && role.equals(n.path("role").asText(null))
                        && n.path("applied").asBoolean(false)) {
                    target = (ObjectNode) n;
                    break;
                }
            }
        }
        if (target == null) return false;
        target.put("applied", false);
        target.put("reason", "unreadable");
        return true;
    }

    // ── 产物校验 ──────────────────────────────────────────────

    /**
     * 上游回的字节必须真是一张能解码的图。
     *
     * <p>不校验的话，一段错误 JSON / HTML / 空响应体也会被 {@code store} 原样落进 OSS 并照价扣款，
     * 用户拿到的是一个点不开的「候选图」。WebP 单独按魔术字放行（JDK ImageIO 不带 WebP 解码器）。
     */
    static void requireDecodableImage(byte[] bytes) {
        if (!looksLikeImage(bytes)) {
            throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "上游返回的内容不是可用图片");
        }
    }

    static boolean looksLikeImage(byte[] b) {
        if (b == null || b.length < 12) return false;
        // 与上传同一套「只读文件头」判定（IpProjectService.readDimensions）：既确认是真图片，
        // 又不为了校验去整图解码一遍（上游同样可能回一张声明 50000×50000 的 PNG）
        if (IpProjectService.readDimensions(b) != null) return true;
        // RIFF....WEBP —— JDK 没有 WebP 读取器，按魔术字放行（我们自己不生产 WebP，纯兜底）
        return b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
    }

    /** hold 时写进 _exec 的单价快照；老行（无快照）回落当前后台单价。 */
    private static long unitCostOf(JsonNode exec, long fallback) {
        JsonNode v = exec.path("unitCost");
        return v.isNumber() && v.asLong() >= 0 ? v.asLong() : fallback;
    }

    // ── 状态写入 ──────────────────────────────────────────────

    /**
     * 派发失败（线程池排满）的收尾：置 failed + 释放冻结。
     *
     * <p>{@code REQUIRES_NEW}：调用方在 {@code afterCommit} 里，那时原事务已经提交、
     * 当前线程没有可用事务，不新开一个就写不进去。
     */
    @org.springframework.transaction.annotation.Transactional(
            propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void abandon(String runId, String code, String message) {
        IpRun run = runRepo.findById(runId).orElse(null);
        if (run == null || !IpRun.STATUS_RUNNING.equals(run.getStatus())) return;
        release(run, "IP 运行未能派发 · 释放冻结");
        failWithoutSpend(run, code, message);
    }

    private boolean isCancelRequested(IpRun run) {
        IpRun fresh = runRepo.findById(run.getId()).orElse(null);
        return fresh != null && fresh.isCancelRequested();
    }

    private void progress(IpRun run, int pct, String stage) {
        run.setPct(Math.min(99, Math.max(0, pct)));
        run.setStage(stage);
        run.setHeartbeatAt(Instant.now());
        runRepo.save(run);
    }

    private void finish(IpRun run) {
        run.setStatus(IpRun.STATUS_DONE);
        run.setStage("done");
        run.setPct(100);
        run.setErrorCode(null);
        run.setErrorMessage(null);
        run.setHeartbeatAt(Instant.now());
        run.setFinishedAt(Instant.now());
        runRepo.save(run);
        log.info("[ipstudio] 运行完成 run={} kind={} cost={}", run.getId(), run.getKind(), run.getCost());
    }

    /** 一次都没 commit 就失败：{@code cost} 必须归零 —— 建行时写的是冻结额，失败后留着就是虚报花费。 */
    private void failWithoutSpend(IpRun run, String code, String message) {
        run.setCost(0);
        fail(run, code, message);
    }

    private void fail(IpRun run, String code, String message) {
        run.setStatus(IpRun.STATUS_FAILED);
        run.setStage("failed");
        run.setErrorCode(code);
        run.setErrorMessage(message);
        run.setHeartbeatAt(Instant.now());
        run.setFinishedAt(Instant.now());
        runRepo.save(run);
        log.warn("[ipstudio] 运行失败 run={} kind={} code={} msg={}", run.getId(), run.getKind(), code, message);
    }

    /** best-effort 释放：释放本身失败不能覆盖业务终态（同 DapJobRunner.releaseCredits）。 */
    private void release(IpRun run, String reason) {
        try {
            credits.releaseHold(IpRunService.REF_TYPE, run.getId(), reason);
        } catch (Exception e) {
            log.warn("[ipstudio] 释放冻结失败 run={}: {}", run.getId(), e.getMessage());
        }
    }

    private static String codeOf(RuntimeException e) {
        if (e instanceof DapModelException dme) return dme.getCode();
        if (e instanceof com.aistareco.common.BusinessException be) return be.getCode();
        return "IP_IMAGE_FAILED";
    }

    /**
     * 只把我们自己写过文案的异常直出给用户。框架异常（如 {@code commitHold} 的
     * {@code ResponseStatusException}）的 message 是给排障看的技术串，
     * 塞进界面就是「409 CONFLICT "hold 已是终态"」这种天书 —— 详情已在 WARN 日志里。
     */
    private static String friendly(RuntimeException e) {
        String fallback = "生成失败，请稍后重试";
        if (e == null) return fallback;
        if (!(e instanceof DapModelException) && !(e instanceof com.aistareco.common.BusinessException)) {
            return fallback;
        }
        String m = e.getMessage();
        return m == null || m.isBlank() ? fallback : m;
    }

    private static String textOf(JsonNode n, String field) {
        if (n == null) return null;
        JsonNode v = n.path(field);
        if (!v.isTextual()) return null;
        String s = v.asText().trim();
        return s.isEmpty() ? null : s;
    }

    private String write(JsonNode n) {
        try {
            return om.writeValueAsString(n);
        } catch (Exception e) {
            return "{}";
        }
    }
}
