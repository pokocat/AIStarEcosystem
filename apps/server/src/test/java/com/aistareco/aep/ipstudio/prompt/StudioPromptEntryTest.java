package com.aistareco.aep.ipstudio.prompt;

import com.aistareco.aep.ipstudio.h3.H3PromptRewrite;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 提示词库条目的校验、仓库文件全量解析、调用点登记的核对（docs/studio-prompt-architecture.md §3.2、§4.3）。 */
class StudioPromptEntryTest {

    @Test
    void everyRepositoryFileParsesAndNoneCollidesWithAWorkflowMethod() {
        var seeds = StudioPromptLibrary.loadSeeds();
        assertThat(seeds).extracting(s -> s.entry().key()).contains("base", "stage-scene-image", "stage-scene-handoff", "stage-scene-script",
                "scene-local-groupbuy", "scene-ecom-talking", "scene-ip-sheet");
        assertThat(seeds).extracting(s -> s.entry().key()).doesNotContainAnyElementsOf(StudioSkillCatalog.loadSeedFiles());
        // every registered call point has its stage in the repository, and every stage file is a registered call point
        assertThat(seeds.stream().filter(s -> s.entry().stage()).map(s -> s.entry().key()))
                .containsExactlyInAnyOrderElementsOf(StudioPromptStages.all().stream().map(StudioPromptStages.Stage::key).toList());
    }

    @Test
    void theWorkflowMethodsAreStillOnlyReadByTheSkillCatalog() {
        String method = "---\nkey: x\nname: x\nversion: 1\nstatus: active\nplanning: dynamic\noperations: {analysis: [], production: [image]}\n"
                + "limits: {maxSourceSec: 60, maxSegments: 1, maxSegmentSec: model, maxSteps: 4}\nchecks: []\n---\n正文";
        assertThat(StudioSkillCatalog.parse(method).key()).isEqualTo("x");
        assertThatThrownBy(() -> StudioPromptEntry.parse(method)).hasMessageContaining("制作做法");
        String content = "---\nkey: method-commerce\nname: 电商带货\nversion: 1\nstatus: active\nlayer: method\nkind: content\n---\n开头抓人";
        assertThat(StudioPromptEntry.parse(content).layer()).isEqualTo("method");
        assertThatThrownBy(() -> StudioSkillCatalog.parse(content)).hasMessageContaining("not a workflow method");
    }

    @Test
    void onlyStagesMayPlaceLayerOrFormatVariables() {
        assertThatThrownBy(() -> StudioPromptEntry.parse("---\nkey: scene-x\nname: x\nversion: 1\nstatus: active\nlayer: scene\nsceneId: x\nsceneKind: video\n---\n{{base}}拍法"))
                .hasMessageContaining("只有环节能放");
        assertThatThrownBy(() -> StudioPromptEntry.parse("---\nkey: base\nname: 底座\nversion: 1\nstatus: active\nlayer: base\nextra: 1\n---\n"))
                .hasMessageContaining("unknown header field");
    }

    @Test
    void aStageMustMatchItsCallPoint() {
        String head = "---\nkey: stage-scene-script\nname: 编导\nversion: 1\nstatus: active\nlayer: stage\ntarget: llm\n---\n";
        String ok = "{{base}}\n角色\n{{format.output}}\n---\n{{duration}}{{sceneTitle}}{{language}}{{format.shots}}{{format.attachments}}";
        assertThat(StudioPromptEntry.parse(head + ok).system()).isEqualTo("{{base}}\n角色\n{{format.output}}");
        assertThatThrownBy(() -> StudioPromptEntry.parse(head + ok.replace("{{base}}\n", ""))).hasMessageContaining("{{base}}");
        assertThatThrownBy(() -> StudioPromptEntry.parse(head + ok.replace("{{format.shots}}", ""))).hasMessageContaining("format.shots");
        assertThatThrownBy(() -> StudioPromptEntry.parse(head + ok + "{{nobody}}")).hasMessageContaining("{{nobody}}");
        assertThatThrownBy(() -> StudioPromptEntry.parse(head + ok.replace("{{language}}", ""))).hasMessageContaining("{{language}}");
        assertThatThrownBy(() -> StudioPromptEntry.parse(head.replace("stage-scene-script", "stage-nowhere") + ok)).hasMessageContaining("没有对应的调用点");
    }

    /** §9.4：镜头行例子必须是 H3 改写认得出的写法，时长很短时例子也不超过总时长。 */
    @Test
    void theShotFormatExampleIsWhatTheH3RewriteParses() {
        for (int d : List.of(4, 10, 15, 25, 45)) {
            String shots = StudioPromptCallPoints.shots(Map.of("duration", d));
            assertThat(H3PromptRewrite.shotStarts(shots, d)).as("duration " + d).isNotNull().first().isEqualTo(0.0);
            assertThat(shots).contains("正好 " + d + " 秒", "补到 " + d + " 秒整").doesNotContain("起–止", "a–b");
            assertThat(H3PromptRewrite.source(shots, List.of()).lines()).isNotEmpty();
        }
        assertThat(StudioPromptCallPoints.shots(Map.of("duration", 3))).doesNotContain("第2镜");
    }
}
