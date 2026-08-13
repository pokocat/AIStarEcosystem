package com.aistareco.aep.clip;

import com.aistareco.aep.clip.dto.ClipVendorDtos.ReconcileDto;
import com.aistareco.aep.clip.service.ClipVendorService;
import com.aistareco.aep.clip.service.ClipVendorService.LocalRow;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway.VendorObject;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 石榴对账三分类的纯函数覆盖。
 *
 * 这是「石榴AI 供应商管理」页最有价值也最容易误报的一段逻辑：分错一类，运营要么去删还在用的对象，
 * 要么以为一切正常而放着占满的槽位不管。
 */
class ClipVendorReconcileTest {

    private static VendorObject vendor(String id, String title) { return new VendorObject(id, title); }

    private static LocalRow local(String id, String engineRef) {
        return new LocalRow(id, "u-1", id + " 的形象", engineRef, "ready", "2026-08-13T00:00:00Z");
    }

    // ── 三类主分类 ──────────────────────────────────────────────────────────────

    @Test
    void classifiesMatchedOrphanAndDangling() {
        ReconcileDto result = ClipVendorService.reconcile(
                List.of(vendor("1001", "两边都有"), vendor("1002", "只有石榴有")),
                List.of(local("DH-1", "1001"), local("DH-2", "1003")));

        assertNull(result.error());
        assertEquals(2, result.vendorCount());
        assertEquals(2, result.localCount());

        assertEquals(List.of("1001"), result.matched().stream().map(m -> m.engineRef()).toList());
        assertEquals("两边都有", result.matched().get(0).vendorTitle());
        assertEquals("DH-1", result.matched().get(0).localId());

        assertEquals(List.of("1002"), result.orphan().stream().map(o -> o.engineRef()).toList());
        assertEquals("只有石榴有", result.orphan().get(0).vendorTitle());

        assertEquals(List.of("DH-2"), result.dangling().stream().map(d -> d.localId()).toList());
        assertEquals("1003", result.dangling().get(0).engineRef());

        assertTrue(result.unmatchable().isEmpty());
    }

    @Test
    void emptyBothSidesIsCleanNotAnError() {
        ReconcileDto result = ClipVendorService.reconcile(List.of(), List.of());

        assertNull(result.error(), "两边都空是干净，不是读失败");
        assertEquals(0, result.vendorCount());
        assertEquals(0, result.localCount());
        assertTrue(result.matched().isEmpty());
        assertTrue(result.orphan().isEmpty());
        assertTrue(result.dangling().isEmpty());
    }

    @Test
    void vendorOnlyRowsAreAllOrphans() {
        ReconcileDto result = ClipVendorService.reconcile(
                List.of(vendor("1001", "a"), vendor("1002", "b")), List.of());

        assertEquals(2, result.orphan().size());
        assertTrue(result.dangling().isEmpty());
    }

    @Test
    void localOnlyRowsAreAllDangling() {
        ReconcileDto result = ClipVendorService.reconcile(
                List.of(), List.of(local("DH-1", "1001"), local("DH-2", "1002")));

        assertEquals(2, result.dangling().size());
        assertTrue(result.orphan().isEmpty());
    }

    // ── 不该被算成悬挂的本地行 ──────────────────────────────────────────────────

    @Test
    void trainingRowWithoutEngineRefIsUnmatchableNotDangling() {
        // 训练刚起步时 engine_ref 还是 null（ClipAvatarService 先落库再回填）。
        // 算进悬挂 = 把「正在训练」报成「上游已删」。
        ReconcileDto result = ClipVendorService.reconcile(
                List.of(vendor("1001", "a")),
                List.of(local("DH-1", "1001"), local("DH-2", null), local("DH-3", "   ")));

        assertTrue(result.dangling().isEmpty(), "没有 engineRef 的行不是悬挂");
        assertEquals(2, result.unmatchable().size());
        assertTrue(result.unmatchable().stream().allMatch(r -> "training".equals(r.reason())));
        assertEquals(1, result.matched().size());
    }

    @Test
    void mockEraRefIsUnmatchableNotDangling() {
        // mock 时代残留的 engine_ref 形如 mock-voice-xxx，本来就没有上游对象。
        ReconcileDto result = ClipVendorService.reconcile(
                List.of(vendor("1001", "a")),
                List.of(local("VC-1", "mock-voice-9f2c1a"), local("VC-2", "1001")));

        assertTrue(result.dangling().isEmpty());
        assertEquals(1, result.unmatchable().size());
        assertEquals("mock", result.unmatchable().get(0).reason());
        assertEquals("mock-voice-9f2c1a", result.unmatchable().get(0).engineRef());
        assertEquals(1, result.matched().size());
    }

    // ── 多对一 / 去重 / 归一 ────────────────────────────────────────────────────

    @Test
    void oneVendorObjectSharedByManyLocalRowsIsNotOrphan() {
        // 「新形象可复用已有 ready DapVoice」→ 多个本地行指向同一个 speakerId。
        // 按位置一一配对会把被复用的那个音色误判成孤儿。
        ReconcileDto result = ClipVendorService.reconcile(
                List.of(vendor("2001", "共用音色")),
                List.of(local("VC-1", "2001"), local("VC-2", "2001"), local("VC-3", "2001")));

        assertTrue(result.orphan().isEmpty(), "被任意一行引用即已认领，不算孤儿");
        assertEquals(3, result.matched().size());
        assertEquals(1, result.vendorCount());
        assertEquals(3, result.localCount());
    }

    @Test
    void duplicateVendorIdsCountOnce() {
        ReconcileDto result = ClipVendorService.reconcile(
                List.of(vendor("3001", "第一条"), vendor("3001", "重复条")), List.of());

        assertEquals(1, result.vendorCount());
        assertEquals(1, result.orphan().size());
        assertEquals("第一条", result.orphan().get(0).vendorTitle(), "重复 id 保留第一条");
    }

    @Test
    void refsAreTrimmedBeforeMatching() {
        ReconcileDto result = ClipVendorService.reconcile(
                List.of(vendor(" 4001 ", "带空白的上游 id")),
                List.of(local("DH-1", "4001\n")));

        assertEquals(1, result.matched().size());
        assertTrue(result.orphan().isEmpty());
        assertTrue(result.dangling().isEmpty());
    }

    @Test
    void nullEntriesOnEitherSideAreSkipped() {
        List<VendorObject> vendors = new java.util.ArrayList<>();
        vendors.add(null);
        vendors.add(vendor("5001", "有效"));
        List<LocalRow> locals = new java.util.ArrayList<>();
        locals.add(null);
        locals.add(local("DH-1", "5001"));

        ReconcileDto result = ClipVendorService.reconcile(vendors, locals);

        assertEquals(1, result.vendorCount());
        assertEquals(1, result.matched().size());
        assertTrue(result.orphan().isEmpty());
    }

    // ── 读失败 ≠ 空态 ──────────────────────────────────────────────────────────

    @Test
    void failedSideCarriesErrorAndNullVendorCount() {
        // 读失败时 vendorCount 必须是 null 而不是 0，且三类列表全空 ——
        // 否则前端会把「没读到」渲染成「石榴侧一个都没有，本地全是悬挂」。
        ReconcileDto failed = ReconcileDto.failed("石榴 AI 暂时不可用，请稍后重试", 7);

        assertEquals("石榴 AI 暂时不可用，请稍后重试", failed.error());
        assertNull(failed.vendorCount());
        assertEquals(7, failed.localCount());
        assertTrue(failed.matched().isEmpty());
        assertTrue(failed.orphan().isEmpty());
        assertTrue(failed.dangling().isEmpty(), "读失败不得产出任何悬挂结论");
        assertTrue(failed.unmatchable().isEmpty());
    }
}
