package com.aistareco.aep.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 锁定 F-02 修复（例行 QA 2026-07-05 审计）：
 * {@code POST /api/material/videos/generate} 的外部请求体不得携带
 * {@code credit_cost}/{@code credit_label} 生效——这两个字段只应由内部 Java 调用方
 * （DramaRenderService 直接调用 MaterialVideoJobService.submit）注入。
 * 未剥离时，任意登录用户可传 {@code credit_cost:0} 跳过 hold 免费刷带货视频算力。
 */
class MaterialOpsControllerTest {

    private final ObjectMapper om = new ObjectMapper();

    @Test
    void stripClientPricingOverrides_removesCreditCostAndLabelFromEveryItem() throws Exception {
        JsonNode body = om.readTree("""
                {"items":[
                  {"script_id":"s1","product_id":"p1","credit_cost":0,"credit_label":"免费"},
                  {"script_id":"s2","product_id":"p2","credit_cost":9999}
                ]}
                """);

        JsonNode sanitized = MaterialOpsController.stripClientPricingOverrides(body);

        for (JsonNode item : sanitized.get("items")) {
            assertFalse(item.has("credit_cost"), "credit_cost 必须被剥离，不能被外部客户端覆盖单价");
            assertFalse(item.has("credit_label"), "credit_label 同样须剥离");
        }
        // 其余字段原样保留，未被误删
        assertEquals("s1", sanitized.get("items").get(0).get("script_id").asText());
        assertEquals("p2", sanitized.get("items").get(1).get("product_id").asText());
    }

    @Test
    void stripClientPricingOverrides_handlesNullBodyAndMissingItems() throws Exception {
        assertNull(MaterialOpsController.stripClientPricingOverrides(null));

        JsonNode noItems = om.readTree("{}");
        JsonNode result = MaterialOpsController.stripClientPricingOverrides(noItems);
        assertTrue(result.isObject());
        assertFalse(result.has("items"));
    }
}
