package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos;
import com.aistareco.aep.ipstudio.service.StudioScriptRevision;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class StudioScriptRevisionTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private final String document="# 雨夜\n\n## 故事大纲\n原有故事\n## 人物小传\n### 林\n## 场景设计\n### 车站\n## 道具设计\n## 分集剧本\n### 第 1 集 · 开场\n正文";
    @Test void normalAssistantAndInEditorRevisionHaveSeparateOutputContracts() {
        assertDoesNotThrow(()->StudioScriptRevision.validateOutput(mapper.createObjectNode().put("summary","已加强冲突").put("markdown",document)));
        var plan=mapper.createObjectNode().put("summary","创作建议");plan.putArray("steps");plan.putArray("questions");
        assertThrows(BusinessException.class,()->StudioScriptRevision.validateOutput(plan));
    }
    @Test void missingDuplicateAndFencedHeadingsCannotMasqueradeAsCompleteRevisions() {
        for(String invalid:new String[]{document.replace("## 人物小传","## 人物"),document+"\n## 人物小传","```md\n"+document+"\n```",document+"x".repeat(48000)})
            assertThrows(BusinessException.class,()->StudioScriptRevision.validateOutput(mapper.createObjectNode().put("summary","修改").put("markdown",invalid)));
    }
    @Test void inputIsBoundedAndOnlyAcceptedOnTheTextAssistantPath() throws Exception {
        var json=mapper.createObjectNode().put("clientRequestId","one-key").put("nodeId","script").put("operation","assistant").put("prompt","增强冲突");json.putObject("scriptEdit").put("markdown",document);
        assertDoesNotThrow(()->StudioScriptRevision.validateInput(mapper.treeToValue(json,StudioWorkflowDtos.RunRequest.class)));
        json.put("operation","script");assertThrows(BusinessException.class,()->StudioScriptRevision.validateInput(mapper.treeToValue(json,StudioWorkflowDtos.RunRequest.class)));
        json.put("operation","assistant").put("readVisuals",true);assertThrows(BusinessException.class,()->StudioScriptRevision.validateInput(mapper.treeToValue(json,StudioWorkflowDtos.RunRequest.class)));
    }
    @Test void richHeadingMarksDoNotChangeFrameworkOrEpisodeIdentity() {
        String rich=document.replace("# 雨夜","# *雨夜 \\*特别篇\\* \\#*")
                .replace("## 故事大纲","## **故事大纲**")
                .replace("## 人物小传","## ++人物小传++")
                .replace("## 场景设计","## ~~场景设计~~")
                .replace("## 道具设计","## [道具设计](https://example.com)")
                .replace("## 分集剧本","## **++分集剧本++**")
                .replace("### 第 1 集 · 开场","### ~~**第 1 集 · 开场**~~");
        var revision=mapper.createObjectNode().put("summary","保留格式稿").put("markdown",rich);
        assertDoesNotThrow(()->StudioScriptRevision.validateOutput(revision));
        assertEquals(rich,revision.path("markdown").asText());
        assertThrows(BusinessException.class,()->StudioScriptRevision.validateOutput(mapper.createObjectNode().put("summary","修改").put("markdown",rich+"\n### ++第 1 集 · 重复++")));
        assertThrows(BusinessException.class,()->StudioScriptRevision.validateOutput(mapper.createObjectNode().put("summary","修改").put("markdown",document.replace("## 人物小传","## \\*人物小传\\*"))));
    }
}
