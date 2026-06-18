package com.aistareco.aep.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 视觉一致性中间件（v0.80）纯函数单测：候选清单拼装 + 下标净化 + JSON 围栏剥离。
 * 这些是「选参考图」环节的安全/格式逻辑，不依赖外部模型，可独立验证。
 */
class DramaRenderServiceTest {

    private final ObjectMapper om = new ObjectMapper();

    private List<JsonNode> pool(String... descs) throws Exception {
        List<JsonNode> items = new ArrayList<>();
        for (int i = 0; i < descs.length; i++) {
            items.add(om.readTree("{\"url\":\"u" + i + "\",\"desc\":\"" + descs[i] + "\"}"));
        }
        return items;
    }

    @Test
    void buildCandidateBlock_numbersEachCandidate() throws Exception {
        String block = DramaRenderService.buildCandidateBlock(pool("角色林夏正面", "场景霓虹雨夜"));
        assertEquals("候选0：角色林夏正面\n候选1：场景霓虹雨夜", block);
    }

    @Test
    void sanitizeIndices_dropsOutOfRangeNegativeAndDuplicate() throws Exception {
        // 模型可能回越界(99)、负数(-1)、重复(2)，都必须被丢弃，对应 ViMax select_pairs_by_indices 越界保护。
        JsonNode arr = om.readTree("[0, 2, 5, -1, 2, 99]");
        List<Integer> idx = DramaRenderService.sanitizeIndices(arr, 6, 6);
        assertEquals(List.of(0, 2, 5), idx);
    }

    @Test
    void sanitizeIndices_capsAtMax() throws Exception {
        JsonNode arr = om.readTree("[0, 1, 2, 3, 4, 5, 6, 7]");
        List<Integer> idx = DramaRenderService.sanitizeIndices(arr, 10, 6);
        assertEquals(6, idx.size());
        assertEquals(List.of(0, 1, 2, 3, 4, 5), idx);
    }

    @Test
    void sanitizeIndices_handlesNullAndNonArray() throws Exception {
        assertTrue(DramaRenderService.sanitizeIndices(null, 5, 6).isEmpty());
        assertTrue(DramaRenderService.sanitizeIndices(om.readTree("\"oops\""), 5, 6).isEmpty());
    }

    @Test
    void stripFences_removesJsonCodeFence() {
        assertEquals("{\"a\":1}", DramaRenderService.stripFences("```json\n{\"a\":1}\n```"));
        assertEquals("{\"a\":1}", DramaRenderService.stripFences("{\"a\":1}"));
    }
}
