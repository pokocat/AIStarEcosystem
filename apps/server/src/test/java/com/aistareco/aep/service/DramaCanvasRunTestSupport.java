package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaCanvas;
import com.aistareco.aep.model.DramaCanvasRun;
import com.aistareco.aep.repository.DramaCanvasRunRepository;
import com.aistareco.aep.repository.PromptTemplateRepository;
import com.aistareco.aep.repository.PromptTemplateVersionRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.mockito.stubbing.Answer;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 画布运行记录测试的共用夹具：内存版仓库（条件更新 + 唯一键）、会真触发 afterCommit 的事务管理器、样例文档。 */
final class DramaCanvasRunTestSupport {

    static final ObjectMapper OM = new ObjectMapper();
    static final String USER = "u1";
    static final String CANVAS = "dcv_1";

    private DramaCanvasRunTestSupport() {
    }

    /** 内存版 DramaCanvasRunRepository：行为贴近真库（条件状态迁移、(owner, clientRequestId) 唯一）。 */
    static DramaCanvasRunRepository inMemoryRuns(Map<String, DramaCanvasRun> store) {
        DramaCanvasRunRepository repo = mock(DramaCanvasRunRepository.class);
        Answer<DramaCanvasRun> save = inv -> {
            DramaCanvasRun r = inv.getArgument(0);
            for (DramaCanvasRun o : store.values()) {
                if (!o.getId().equals(r.getId()) && Objects.equals(o.getOwnerUserId(), r.getOwnerUserId())
                        && o.getClientRequestId() != null && o.getClientRequestId().equals(r.getClientRequestId())) {
                    throw new DataIntegrityViolationException("uk_drama_canvas_run_owner_req");
                }
            }
            store.put(r.getId(), r);
            return r;
        };
        when(repo.save(any(DramaCanvasRun.class))).thenAnswer(save);
        when(repo.saveAndFlush(any(DramaCanvasRun.class))).thenAnswer(save);
        when(repo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(store.get((String) inv.getArgument(0))));
        when(repo.findAllById(any())).thenAnswer(inv -> {
            List<DramaCanvasRun> out = new ArrayList<>();
            for (Object id : (Iterable<?>) inv.getArgument(0)) {
                DramaCanvasRun r = store.get(id);
                if (r != null) out.add(r);
            }
            return out;
        });
        when(repo.findByOwnerUserIdAndClientRequestId(anyString(), anyString())).thenAnswer(inv -> store.values().stream()
                .filter(r -> r.getOwnerUserId().equals(inv.getArgument(0))
                        && inv.getArgument(1).equals(r.getClientRequestId()))
                .findFirst());
        when(repo.findByIdAndOwnerUserIdAndCanvasId(anyString(), anyString(), anyString())).thenAnswer(inv -> {
            DramaCanvasRun r = store.get((String) inv.getArgument(0));
            return r != null && r.getOwnerUserId().equals(inv.getArgument(1)) && r.getCanvasId().equals(inv.getArgument(2))
                    ? Optional.of(r) : Optional.empty();
        });
        when(repo.findByOwnerUserIdAndCanvasIdAndIdIn(anyString(), anyString(), any())).thenAnswer(inv -> {
            Collection<?> ids = inv.getArgument(2);
            return store.values().stream()
                    .filter(r -> r.getOwnerUserId().equals(inv.getArgument(0)) && r.getCanvasId().equals(inv.getArgument(1))
                            && ids.contains(r.getId()))
                    .toList();
        });
        when(repo.findByStatusInAndUpdatedAtBefore(any(), any())).thenAnswer(inv -> {
            Collection<?> statuses = inv.getArgument(0);
            OffsetDateTime cutoff = inv.getArgument(1);
            return store.values().stream()
                    .filter(r -> statuses.contains(r.getStatus()) && r.getUpdatedAt() != null && r.getUpdatedAt().isBefore(cutoff))
                    .toList();
        });
        when(repo.transition(anyString(), anyString(), anyString(), any())).thenAnswer(inv -> {
            DramaCanvasRun r = store.get((String) inv.getArgument(0));
            if (r == null || !inv.getArgument(1).equals(r.getStatus())) return 0;
            r.setStatus(inv.getArgument(2));
            r.setUpdatedAt(inv.getArgument(3));
            return 1;
        });
        when(repo.progress(anyString(), any(), any())).thenAnswer(inv -> {
            DramaCanvasRun r = store.get((String) inv.getArgument(0));
            if (r == null || !DramaCanvasRun.STATUS_RUNNING.equals(r.getStatus())) return 0;
            r.setResultJson(inv.getArgument(1));
            r.setUpdatedAt(inv.getArgument(2));
            return 1;
        });
        when(repo.succeed(anyString(), any(), any(), any(), anyLong(), any())).thenAnswer(inv -> {
            DramaCanvasRun r = store.get((String) inv.getArgument(0));
            if (r == null || !((Collection<?>) inv.getArgument(1)).contains(r.getStatus())) return 0;
            r.setStatus(DramaCanvasRun.STATUS_SUCCEEDED);
            r.setResultJson(inv.getArgument(2));
            r.setRefsJson(inv.getArgument(3));
            r.setCost(inv.getArgument(4));
            r.setErrorCode(null);
            r.setErrorMessage(null);
            r.setUpdatedAt(inv.getArgument(5));
            r.setFinishedAt(inv.getArgument(5));
            return 1;
        });
        when(repo.fail(anyString(), any(), any(), any(), any())).thenAnswer(inv -> {
            DramaCanvasRun r = store.get((String) inv.getArgument(0));
            if (r == null || !((Collection<?>) inv.getArgument(1)).contains(r.getStatus())) return 0;
            r.setStatus(DramaCanvasRun.STATUS_FAILED);
            r.setErrorCode(inv.getArgument(2));
            r.setErrorMessage(inv.getArgument(3));
            r.setUpdatedAt(inv.getArgument(4));
            r.setFinishedAt(inv.getArgument(4));
            return 1;
        });
        when(repo.cancel(anyString(), any(), any(), any())).thenAnswer(inv -> {
            DramaCanvasRun r = store.get((String) inv.getArgument(0));
            if (r == null || !((Collection<?>) inv.getArgument(1)).contains(r.getStatus())) return 0;
            r.setStatus(DramaCanvasRun.STATUS_CANCELED);
            r.setErrorCode(null);
            r.setErrorMessage(inv.getArgument(2));
            r.setUpdatedAt(inv.getArgument(3));
            r.setFinishedAt(inv.getArgument(3));
            return 1;
        });
        when(repo.expireIfUnchanged(anyString(), any(), anyString(), anyLong(), any(), any(), any(), any())).thenAnswer(inv -> {
            DramaCanvasRun r = store.get((String) inv.getArgument(0));
            if (r == null || r.isTerminal() || !Objects.equals(r.getUpdatedAt(), inv.getArgument(1))) return 0;
            r.setStatus(inv.getArgument(2));
            r.setCost(inv.getArgument(3));
            r.setRefsJson(inv.getArgument(4));
            r.setErrorCode(inv.getArgument(5));
            r.setErrorMessage(inv.getArgument(6));
            r.setUpdatedAt(inv.getArgument(7));
            r.setFinishedAt(inv.getArgument(7));
            return 1;
        });
        when(repo.setRefsIfActive(anyString(), any())).thenAnswer(inv -> {
            DramaCanvasRun r = store.get((String) inv.getArgument(0));
            if (r == null || r.isTerminal()) return 0;
            r.setRefsJson(inv.getArgument(1));
            return 1;
        });
        when(repo.touch(any(), any())).thenAnswer(inv -> {
            int n = 0;
            for (Object id : (Collection<?>) inv.getArgument(0)) {
                DramaCanvasRun r = store.get(id);
                if (r != null && !r.isTerminal()) {
                    r.setUpdatedAt(inv.getArgument(1));
                    n++;
                }
            }
            return n;
        });
        return repo;
    }

    /**
     * 最小的真事务管理器：会真的开 / 提交 / 回滚，在提交时触发 afterCommit（回滚时不触发），支持 REQUIRES_NEW 的挂起 / 恢复。
     * 给了 store 时还模拟数据库回滚：每个新事务开始时给内存仓库拍快照，回滚就恢复成快照（提交就丢掉快照）。
     */
    static final class TestTxManager extends AbstractPlatformTransactionManager {
        final AtomicInteger commits = new AtomicInteger();
        final AtomicInteger rollbacks = new AtomicInteger();
        private final ThreadLocal<Object> current = new ThreadLocal<>();
        private final Map<String, DramaCanvasRun> store;
        private final java.util.ArrayDeque<Map<String, DramaCanvasRun>> snapshots = new java.util.ArrayDeque<>();

        TestTxManager() {
            this(null);
        }

        TestTxManager(Map<String, DramaCanvasRun> store) {
            this.store = store;
        }

        private record Tx(Object existing) {}

        @Override
        protected Object doSuspend(Object transaction) {
            Object cur = current.get();
            current.remove();
            return cur;
        }

        @Override
        protected void doResume(Object transaction, Object suspendedResources) {
            if (suspendedResources != null) current.set(suspendedResources);
        }

        @Override
        protected Object doGetTransaction() {
            return new Tx(current.get());
        }

        @Override
        protected boolean isExistingTransaction(Object transaction) {
            return ((Tx) transaction).existing() != null;
        }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {
            current.set(transaction);
            if (store != null) {
                Map<String, DramaCanvasRun> snap = new java.util.LinkedHashMap<>();
                store.forEach((k, v) -> snap.put(k, copy(v)));
                snapshots.push(snap);
            }
        }

        @Override
        protected void doCommit(DefaultTransactionStatus status) {
            commits.incrementAndGet();
            if (store != null && !snapshots.isEmpty()) snapshots.pop();
        }

        @Override
        protected void doRollback(DefaultTransactionStatus status) {
            rollbacks.incrementAndGet();
            if (store != null && !snapshots.isEmpty()) {
                Map<String, DramaCanvasRun> snap = snapshots.pop();
                store.clear();
                store.putAll(snap);
            }
        }

        @Override
        protected void doSetRollbackOnly(DefaultTransactionStatus status) {
            // 参与者标记回滚：外层提交时会转成回滚
        }

        @Override
        protected void doCleanupAfterCompletion(Object transaction) {
            current.remove();
        }
    }

    /** 真 PromptService（repo 为空 → 走 resources/prompts/material/*.md 默认模板）。 */
    static PromptService resourcePrompts() {
        PromptTemplateRepository repo = mock(PromptTemplateRepository.class);
        when(repo.findByPromptKey(anyString())).thenReturn(Optional.empty());
        return new PromptService(repo, mock(PromptTemplateVersionRepository.class),
                mock(AiModelEndpointRepository.class), mock(AiModelInvocationService.class), OM);
    }

    static DramaCanvas canvas(JsonNode doc, String ratio) {
        String canonical = DramaCanvasDocs.canonicalJson(doc);
        return DramaCanvas.builder()
                .id(CANVAS)
                .ownerUserId(USER)
                .title("测试画布")
                .ratio(ratio)
                .docJson(canonical)
                .docVersion(DramaCanvasDocs.docVersionOf(canonical))
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
    }

    /**
     * 样例文档：1 个角色（造型 lk1，有图）、1 个场景 sc1（有图）、素材图 m1（有图）、文字素材 m2；
     * 连线 sc1→lk1、m2→lk1、m1→lk1；第 1 集两个片段（sg1 有首帧有视频，sg2 都没有）；第 2 集剧本锁着。
     */
    static ObjectNode sampleDoc() {
        try {
            return (ObjectNode) OM.readTree("""
                    {"schema":1,"source":"idea",
                     "style":{"id":"film90","name":"90 年代写实","prompt":"90 年代写实电影风格，胶片颗粒"},
                     "script":{"idea":"老中学拆除前，旧教室里找到一封十七年前的信","targetEpisodes":3,"episodeDurationSec":60,
                       "setting":{"text":"题材与基调：悬疑情感。主线：……"},
                       "outline":{"episodes":[{"no":1,"title":"旧信","hook":"开场","summary":"梗概1"},
                                              {"no":2,"title":"真相","hook":"开场","summary":"梗概2"},
                                              {"no":3,"title":"和解","hook":"开场","summary":"梗概3"}]},
                       "episodes":[{"no":1,"title":"旧信","text":"### 场1-1\\n日 内 旧教室\\n△ 林微整理旧物。"},
                                   {"no":2,"title":"真相","text":"### 场2-1\\n夜 外 门口\\n△ 陈屹走来。","locked":true}],
                       "history":[]},
                     "characters":[{"id":"ch1","name":"林微","role":"lead","looks":[
                        {"id":"lk1","name":"成年","prompt":"基本信息：女，30 岁","episodes":[1],
                         "images":{"versions":[{"key":"drama/canvas/looks/a.png"}]}}]}],
                     "scenes":[{"id":"sc1","name":"旧教室","prompt":"老教室，午后阳光","episodes":[1],
                                "images":{"versions":[{"key":"drama/canvas/scenes/b.png"}]}}],
                     "materials":[{"id":"m1","name":"铁盒","kind":"image","prompt":"生锈铁盒",
                                   "images":{"versions":[{"key":"drama/canvas/materials/c.png"}]}},
                                  {"id":"m2","name":"说明","kind":"text","text":"盒子上有划痕"}],
                     "board":{"positions":{},"edges":[{"id":"e1","source":"sc1","target":"lk1"},
                                                      {"id":"e2","source":"m2","target":"lk1"},
                                                      {"id":"e3","source":"m1","target":"lk1"}],
                              "collapsed":[],"viewport":{"x":0,"y":0,"zoom":1}},
                     "episodes":[{"no":1,"segments":[
                        {"id":"sg1","text":"（4 秒）日，@[旧教室](scene:sc1)。@[林微·成年](look:lk1) 蹲着整理旧物。\\n（3 秒）特写，@[林微·成年](look:lk1) 拉开抽屉。",
                         "durationSec":7,
                         "frame":{"versions":[{"key":"drama/canvas/frames/f.png"}]},
                         "video":{"versions":[{"key":"material-videos/mvj_a/video.mp4","runId":"r0","createdAt":"2026-09-30T00:00:00Z"}]}},
                        {"id":"sg2","text":"（5 秒）远景，教学楼。","durationSec":5,
                         "frame":{"versions":[]},"video":{"versions":[]}}]}]}
                    """);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** 整行拷贝（模拟「从库里读出来的一份」：回收器读到的旧值、事务快照）。 */
    static DramaCanvasRun copy(DramaCanvasRun r) {
        return DramaCanvasRun.builder().id(r.getId()).canvasId(r.getCanvasId()).ownerUserId(r.getOwnerUserId())
                .kind(r.getKind()).target(r.getTarget()).status(r.getStatus()).cost(r.getCost())
                .clientRequestId(r.getClientRequestId()).jobId(r.getJobId()).inputJson(r.getInputJson())
                .resultJson(r.getResultJson()).refsJson(r.getRefsJson()).errorCode(r.getErrorCode())
                .errorMessage(r.getErrorMessage()).createdAt(r.getCreatedAt()).updatedAt(r.getUpdatedAt())
                .finishedAt(r.getFinishedAt()).build();
    }

    /** 一段能被 ImageBytes.sniff 认成 PNG 的字节。 */
    static byte[] pngBytes() {
        return new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 'I', 'H', 'D', 'R'};
    }

    static DramaCanvasRun run(String id, String kind, String status, ObjectNode exec) {
        ObjectNode input = OM.createObjectNode();
        input.set("_exec", exec);
        OffsetDateTime now = OffsetDateTime.now();
        return DramaCanvasRun.builder()
                .id(id).canvasId(CANVAS).ownerUserId(USER).kind(kind).target("t").status(status).cost(0)
                .clientRequestId("cri-" + id).inputJson(input.toString()).createdAt(now).updatedAt(now).build();
    }
}
