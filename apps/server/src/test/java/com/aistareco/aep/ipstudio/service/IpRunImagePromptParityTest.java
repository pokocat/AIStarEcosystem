package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.prompt.LegacyStepThreeTexts;
import com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler;
import com.aistareco.aep.service.PromptService;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 画布出图包装的参考图说明（docs/studio-prompt-architecture.md §8 #15）：「保持同一个人」、参考图编号、各自是什么这三段的句子进了
 * stage-image，加不加由 {@link IpRunService#imageVars} 判断。拼出来和搬家前的代码（旧句子在 {@link LegacyStepThreeTexts}）逐字相同。
 */
class IpRunImagePromptParityTest {
    private static String legacy(String prompt, List<String> notes) {
        String lead = notes.size() == 1 && !IpRunService.promptDirectsReferences(prompt) ? LegacyStepThreeTexts.ID_LEAD : "";
        StringBuilder order = new StringBuilder();
        if (notes.size() >= 2) {
            order.append("The reference images are given in order: ");
            for (int i = 0; i < notes.size(); i++) order.append(i > 0 ? ", " : "").append("image ").append(i + 1).append(" = 图").append(i + 1);
            order.append(". ");
        }
        StringBuilder refNotes = new StringBuilder();
        for (int i = 0; i < notes.size(); i++) {
            String note = notes.get(i);
            if (note == null || note.isBlank() || "参考图".equals(note.trim())) continue;
            refNotes.append("Reference image ").append(i + 1).append(": ").append(note).append(". ");
        }
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("prompt", prompt); vars.put("refLead", lead); vars.put("refOrder", order.toString()); vars.put("refNotes", refNotes.toString());
        return PromptService.fill(PromptService.resourceDefault("dap.ip_canvas_image")[1], vars).stripTrailing();
    }

    @Test
    void referenceNotesAreUnchangedForEveryShape() {
        var assembler = StudioPromptAssembler.classpath();
        List<List<String>> shapes = new ArrayList<>(List.of(List.of(), List.of("人物设定图"), List.of("参考图"), List.of(" "),
                List.of("人物", "参考图"), List.of("人物", "场景", "道具")));
        shapes.add(Arrays.asList("脸", null, "衣服"));
        int checked = 0;
        for (String prompt : List.of("a red apple on a desk", "用图1的脸和图2的衣服", "keep the reference image style")) for (List<String> notes : shapes) {
            String now = assembler.assemble(StudioPromptAssembler.Call.of("stage-image", IpRunService.imageVars(prompt, notes), null, null)).user();
            assertThat(now).as(prompt + " " + notes).isEqualTo(legacy(prompt, notes));
            checked++;
        }
        assertThat(checked).isEqualTo(3 * 7);
    }
}
