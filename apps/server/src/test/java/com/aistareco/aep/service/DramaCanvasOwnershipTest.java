package com.aistareco.aep.service;

import com.aistareco.aep.model.StorageAsset;
import com.aistareco.aep.repository.StorageAssetRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 归属闸：只认 storage_assets 里 (app=drama, 本人, key) 三者对上的；外形不安全的 key 不查库直接不算；
 * requireOwned 拒绝时带错误码与被拒的 key；record 幂等、撞到别人名下的 key 必须失败。
 */
class DramaCanvasOwnershipTest {

    private static final String ME = "u_me";

    private List<StorageAsset> rows;
    private StorageAssetRepository repo;
    private DramaCanvasOwnership ownership;

    @BeforeEach
    void setup() {
        rows = new ArrayList<>();
        repo = mock(StorageAssetRepository.class);
        when(repo.findOwnedCdnKeys(anyString(), anyString(), any())).thenAnswer(inv -> {
            String app = inv.getArgument(0);
            String uid = inv.getArgument(1);
            Collection<String> keys = inv.getArgument(2);
            List<String> out = new ArrayList<>();
            for (StorageAsset s : rows) {
                if (app.equals(s.getApp()) && uid.equals(s.getOwnerUserId()) && keys.contains(s.getCdnKey())) out.add(s.getCdnKey());
            }
            return out;
        });
        when(repo.findByCdnKey(anyString())).thenAnswer(inv -> rows.stream()
                .filter(s -> s.getCdnKey().equals(inv.getArgument(0))).toList());
        when(repo.save(any())).thenAnswer(inv -> {
            rows.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        ownership = new DramaCanvasOwnership(repo);
    }

    private void row(String app, String owner, String key) {
        rows.add(StorageAsset.builder().id("sa_" + rows.size()).app(app).ownerUserId(owner).cdnKey(key).bytes(1).build());
    }

    @Test
    void ownedKeys_onlyDramaRowsOfThisUser() {
        row("drama", ME, "drama/frames/a.png");
        row("drama", "u_other", "drama/frames/b.png");
        row("celebrity", ME, "material/c.png");
        Set<String> owned = ownership.ownedKeys(ME, List.of("drama/frames/a.png", "drama/frames/b.png", "material/c.png", "nope.png"));
        assertEquals(Set.of("drama/frames/a.png"), owned);
    }

    @Test
    void ownedKeys_unsafeKeysNeverOwned_andNotQueried() {
        row("drama", ME, "../etc/passwd");
        Set<String> owned = ownership.ownedKeys(ME, List.of("../etc/passwd", "/abs/a.png", "a\\b.png", " a.png", "a\u0000.png",
                "x".repeat(513)));
        assertTrue(owned.isEmpty());
        verify(repo, never()).findOwnedCdnKeys(anyString(), anyString(), any());
    }

    @Test
    void ownedKeys_emptyInput_noQuery() {
        assertTrue(ownership.ownedKeys(ME, List.of()).isEmpty());
        assertTrue(ownership.ownedKeys(null, List.of("a")).isEmpty());
        assertTrue(ownership.ownedKeys(ME, null).isEmpty());
        verifyNoInteractions(repo);
    }

    @Test
    @SuppressWarnings("unchecked")
    void ownedKeys_batchesInChunks() {
        List<String> keys = new ArrayList<>();
        for (int i = 0; i < DramaCanvasOwnership.IN_CHUNK + 3; i++) keys.add("k/" + i);
        ownership.ownedKeys(ME, keys);
        ArgumentCaptor<Collection<String>> cap = ArgumentCaptor.forClass(Collection.class);
        verify(repo, times(2)).findOwnedCdnKeys(eq("drama"), eq(ME), cap.capture());
        assertEquals(DramaCanvasOwnership.IN_CHUNK, cap.getAllValues().get(0).size());
        assertEquals(3, cap.getAllValues().get(1).size());
    }

    @Test
    void requireOwned_rejectsWithCodeAndKeys_ignoresBlank() {
        row("drama", ME, "mine.png");
        ownership.requireOwned(ME, java.util.Arrays.asList("mine.png", null, " "));
        BusinessException e = assertThrows(BusinessException.class,
                () -> ownership.requireOwned(ME, List.of("mine.png", "theirs.png")));
        assertEquals("DRAMA_CANVAS_ASSET_NOT_OWNED", e.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        Map<?, ?> details = (Map<?, ?>) e.getDetails();
        assertEquals(List.of("theirs.png"), details.get("keys"));
        assertEquals(1, details.get("count"));
        // 没有 key 不是错
        ownership.requireOwned(ME, List.of());
        ownership.requireOwned(ME, null);
    }

    @Test
    void record_writesDramaRow_andIsIdempotent() {
        ownership.record(ME, "drama/canvas/x.png", 1234, "image/png");
        ownership.record(ME, "drama/canvas/x.png", 1234, "image/png");
        assertEquals(1, rows.size());
        StorageAsset s = rows.get(0);
        assertEquals("drama", s.getApp());
        assertEquals(ME, s.getOwnerUserId());
        assertEquals("drama/canvas/x.png", s.getCdnKey());
        assertEquals(1234, s.getBytes());
        assertEquals("画布图片", s.getCategory());
        assertEquals(Set.of("drama/canvas/x.png"), ownership.ownedKeys(ME, List.of("drama/canvas/x.png")));
        // 上传参考图那条路径（StorageQuotaService）先记过的，不再重复
        row("drama", ME, "drama/asset-refs/u/y.png");
        ownership.record(ME, "drama/asset-refs/u/y.png", 10, "image/jpeg");
        assertEquals(2, rows.size());
    }

    @Test
    void record_keyOwnedBySomeoneElse_fails() {
        row("drama", "u_other", "k.png");
        BusinessException e = assertThrows(BusinessException.class, () -> ownership.record(ME, "k.png", 1, "image/png"));
        assertEquals("DRAMA_CANVAS_ASSET_RECORD_CONFLICT", e.getCode());
        assertEquals(1, rows.size());
        assertTrue(ownership.ownedKeys(ME, List.of("k.png")).isEmpty());
    }

    @Test
    void record_rejectsUnsafeKeyAndBlankUser() {
        assertThrows(IllegalArgumentException.class, () -> ownership.record(ME, "../x.png", 1, "image/png"));
        assertThrows(IllegalArgumentException.class, () -> ownership.record(" ", "x.png", 1, "image/png"));
        assertTrue(rows.isEmpty());
    }

    @Test
    void categoryOf_byContentType() {
        assertEquals("画布图片", DramaCanvasOwnership.categoryOf("IMAGE/JPEG"));
        assertEquals("画布视频", DramaCanvasOwnership.categoryOf("video/mp4"));
        assertEquals("画布其他", DramaCanvasOwnership.categoryOf(null));
    }
}
