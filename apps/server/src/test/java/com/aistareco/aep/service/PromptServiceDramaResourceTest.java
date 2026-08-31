package com.aistareco.aep.service;

import com.aistareco.aep.repository.PromptTemplateRepository;
import com.aistareco.aep.repository.PromptTemplateVersionRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * v0.71：短剧工作台 4 个 prompt 的 resource 默认（resources/prompts/material/drama.*.md）
 * 必须能被真实 PromptService 解析到（origin=resource，非 code），且占位符健在。
 * repo 返回空 → 走 resource 兜底，验证 .md 真的在 classpath 且格式（--- 分隔）正确。
 */
class PromptServiceDramaResourceTest {

    private PromptService realService() {
        PromptTemplateRepository repo = mock(PromptTemplateRepository.class);
        when(repo.findByPromptKey(anyString())).thenReturn(Optional.empty());
        return new PromptService(
                repo,
                mock(PromptTemplateVersionRepository.class),
                mock(AiModelEndpointRepository.class),
                mock(AiModelInvocationService.class),
                new ObjectMapper());
    }

    @Test
    void dramaWorkbenchPromptsResolveFromResource() {
        PromptService svc = realService();
        for (String key : new String[]{
                PromptService.KEY_DRAMA_OUTLINE, PromptService.KEY_DRAMA_EPSCRIPT,
                PromptService.KEY_DRAMA_SPLIT_SCENE, PromptService.KEY_DRAMA_CAST}) {
            PromptService.ResolvedPrompt p = svc.resolve(key);
            assertEquals("resource", p.origin(), key + " 应能从 .md 解析（非 code 兜底）");
            assertFalse(p.system().isBlank(), key + " system 不应为空");
            assertFalse(p.userTemplate().isBlank(), key + " user 模板不应为空");
        }
    }

    @Test
    void shortPromptParseResolvesFromResourceWithPlaceholders() {
        // v0.143 提示词直出：拆解 prompt 的 .md 必须在 classpath（否则 origin=code → 503 不可用）。
        PromptService.ResolvedPrompt p = realService().resolve(PromptService.KEY_DRAMA_SHORT_PROMPT_PARSE);
        assertEquals("resource", p.origin(), "drama.short_prompt_parse 应能从 .md 解析（非 code 兜底）");
        assertFalse(p.system().isBlank());
        for (String ph : new String[]{"{{prompt}}", "{{instructionClause}}", "{{maxShots}}", "{{maxShotSec}}",
                "{{maxCharacters}}", "{{maxScenes}}"}) {
            assertTrue(p.userTemplate().contains(ph) || p.system().contains(ph), "模板应含占位符 " + ph);
        }
        // 服务对 system 与 user 都做 fill（上限规则写在 system 段），两段填完都不该残留占位符。
        java.util.Map<String, String> vars = java.util.Map.of(
                "prompt", "【角色】阿宁：齐耳短发", "instructionClause", "",
                "maxShots", "40", "maxShotSec", "15", "maxCharacters", "6", "maxScenes", "6");
        String filledUser = PromptService.fill(p.userTemplate(), vars);
        String filledSystem = PromptService.fill(p.system(), vars);
        assertTrue(filledUser.contains("齐耳短发"));
        assertFalse(filledUser.contains("{{"), "user 段填充后不应残留占位符");
        assertFalse(filledSystem.contains("{{"), "system 段填充后不应残留占位符");
        assertTrue(filledSystem.contains("40") && filledSystem.contains("15"), "上限应落成真实数字");
    }

    @Test
    void dramaMediaPromptsResolveFromResource() {
        // v0.72：图像/视频是单 prompt（无 system，整块为 user 模板）。
        PromptService svc = realService();
        for (String key : new String[]{
                PromptService.KEY_DRAMA_FRAME_IMAGE, PromptService.KEY_DRAMA_CLIP_VIDEO,
                PromptService.KEY_DRAMA_SHORT_FRAME_IMAGE, PromptService.KEY_DRAMA_SHORT_CLIP_VIDEO}) {
            PromptService.ResolvedPrompt p = svc.resolve(key);
            assertEquals("resource", p.origin(), key + " 应能从 .md 解析（非 code 兜底）");
            assertTrue(p.userTemplate().contains("{{visual}}"), key + " 模板应含 {{visual}} 占位符");
        }
    }

    @Test
    void mediaFillStripsUnfilledPlaceholders() {
        // renderFrame/renderClip 用 vars 填充后会清掉残留占位符；这里验证 fill + 清洗组合行为。
        PromptService.ResolvedPrompt p = realService().resolve(PromptService.KEY_DRAMA_FRAME_IMAGE);
        String filled = PromptService.fill(p.userTemplate(), java.util.Map.of(
                "visual", "林夏拆纸箱抬头看窗外", "size", "中近景", "move", "缓慢推近"))
                .replaceAll("\\{\\{[^}]*}}", "").trim();
        assertTrue(filled.contains("林夏拆纸箱抬头看窗外"));
        assertTrue(filled.contains("景别：中近景"));
        assertFalse(filled.contains("{{"), "残留占位符应被清掉");
    }

    @Test
    void outlineTemplateKeepsPlaceholders() {
        PromptService.ResolvedPrompt p = realService().resolve(PromptService.KEY_DRAMA_OUTLINE);
        assertTrue(p.userTemplate().contains("{{title}}"));
        assertTrue(p.userTemplate().contains("{{count}}"));
        assertTrue(p.userTemplate().contains("{{loglineClause}}"));
        // 填充后占位符应被替换
        String filled = PromptService.fill(p.userTemplate(),
                java.util.Map.of("title", "落地窗后", "type", "悬疑短剧", "count", "6",
                        "loglineClause", "", "mainlineClause", ""));
        assertTrue(filled.contains("落地窗后"));
        assertFalse(filled.contains("{{"));
    }
}
