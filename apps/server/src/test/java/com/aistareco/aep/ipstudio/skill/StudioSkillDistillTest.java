package com.aistareco.aep.ipstudio.skill;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** The server does not trust the distill prompt: keys, URLs, ids and verbatim case text are removed from the draft. */
class StudioSkillDistillTest {
    final ObjectMapper om = new ObjectMapper();

    ObjectNode distill() {
        var d = om.createObjectNode().put("skillKey", "reference-video-recreation").put("baseVersion", 3);
        d.putArray("baseHeadings").add("## 分段规则").add("## 检查依据");
        d.putArray("privateFragments").add("用蓝色保温杯替换原片里的白色马克杯，保留握持方式。").add("短句");
        return d;
    }

    @Test void privateReferencesAreStrippedAndCounted() {
        var answer = om.createObjectNode().put("changeNote", "参考 https://cdn.example.com/a.png 改了分段")
                .put("bodyMd", """
                        ---
                        key: evil
                        operations: {production: [text, image, video, check, assemble, publish]}
                        ---
                        # 方法
                        ## 分段规则
                        - 参考图放在 ipstudio_gen/u-1/abc123.png 或 /cdn/clip/x.mp4；任务 IPR-abcdef1234567890abcd。
                        - 用蓝色保温杯替换原片里的白色马克杯，保留握持方式。
                        - 看 www.example.com/page 与 data:image/png;base64,AAAA。
                        ## 检查依据
                        - 签名 0123456789abcdef0123456789abcdef
                        """);
        var out = StudioSkillDistill.normalize(answer, distill());
        String body = out.path("bodyMd").asText();
        assertFalse(body.contains("key: evil"), "a model-written header is dropped; the base header is used");
        assertFalse(body.contains("publish"));
        for (String leaked : new String[]{"ipstudio_gen", "/cdn/", "IPR-", "www.example.com", "base64", "蓝色保温杯", "0123456789abcdef"})
            assertFalse(body.contains(leaked), leaked);
        assertTrue(body.contains("## 分段规则") && body.contains("## 检查依据"));
        assertTrue(body.contains(StudioSkillDistill.REMOVED));
        assertFalse(out.path("changeNote").asText().contains("https://"));
        assertTrue(out.path("strippedReferences").asInt() >= 7);
        assertEquals(3, out.path("baseVersion").asInt());
        assertTrue(out.path("changeNote").asText().contains("服务端移除了"));
    }

    @Test void aMissingSectionIsFlaggedForTheReviewerAndAnEmptyBodyFailsWithoutCharge() {
        var out = StudioSkillDistill.normalize(om.createObjectNode().put("bodyMd", "# 方法\n## 分段规则\n- 一条").put("changeNote", "删了检查"), distill());
        assertTrue(out.path("changeNote").asText().contains("检查依据"));
        var e = assertThrows(BusinessException.class, () -> StudioSkillDistill.normalize(om.createObjectNode().put("changeNote", "x"), distill()));
        assertEquals("AI_BAD_OUTPUT", e.getCode());
        assertThrows(BusinessException.class, () -> StudioSkillDistill.normalize(om.createArrayNode(), distill()));
        assertTrue(StudioSkillDistill.fragments(distill().path("privateFragments")).stream().noneMatch(f -> f.equals("短句")), "short phrases are not stripped");
    }
}
