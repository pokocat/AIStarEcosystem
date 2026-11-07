package com.aistareco.aep.ipstudio.prompt;

import com.aistareco.aep.service.PromptService;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 提示词模板（docs/studio-prompt-architecture.md §3.3）：三种写法、和旧 fill 兼容、两条整行规则。 */
class PromptTemplateTest {

    @Test
    void plainVariablesRenderLikeTheOldFillIncludingSpacesAndMissingNames() {
        String t = "你好 {{ name }}，{{missing}}来自{{city}}。";
        Map<String, String> vars = Map.of("name", "小雅", "city", "杭州");
        assertThat(PromptTemplate.render(t, vars)).isEqualTo(PromptService.fill(t, vars)).isEqualTo("你好 小雅，来自杭州。");
    }

    @Test
    void sectionsShowOnTruthyValuesAndInvertedSectionsOnFalsyOnes() {
        String t = "{{#ask}}我的要求：{{ask}}{{/ask}}{{^ask}}没写要求{{/ask}}";
        assertThat(PromptTemplate.render(t, Map.of("ask", "口语一点"))).isEqualTo("我的要求：口语一点");
        assertThat(PromptTemplate.render(t, Map.of("ask", ""))).isEqualTo("没写要求");
        assertThat(PromptTemplate.render(t, Map.of())).isEqualTo("没写要求");
        assertThat(PromptTemplate.render("{{#on}}开{{/on}}", Map.of("on", false))).isEmpty();
    }

    @Test
    void listsIterateWithFirstAndLastForSeparators() {
        String t = "{{#refs}}图{{n}}「{{title}}」{{^-last}}；{{/-last}}{{/refs}}";
        var refs = List.of(Map.of("n", 1, "title", "门头"), Map.of("n", 2, "title", "达人"));
        assertThat(PromptTemplate.render(t, Map.of("refs", refs))).isEqualTo("图1「门头」；图2「达人」");
        assertThat(PromptTemplate.render("{{#names}}「{{.}}」{{/names}}", Map.of("names", List.of("a", "b")))).isEqualTo("「a」「b」");
    }

    @Test
    void aWholeKeyWinsOverDottedLookupSoCallersCanPassFormatParts() {
        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("format.output", "只输出 JSON");
        vars.put("a", Map.of("b", "深一层"));
        assertThat(PromptTemplate.render("{{format.output}}|{{a.b}}", vars)).isEqualTo("只输出 JSON|深一层");
    }

    @Test
    void aLineHoldingOnlyASectionTagDisappears() {
        String t = "第一行\n{{#ask}}\n我的要求：{{ask}}\n{{/ask}}\n最后一行";
        assertThat(PromptTemplate.render(t, Map.of("ask", "x"))).isEqualTo("第一行\n我的要求：x\n最后一行");
        assertThat(PromptTemplate.render(t, Map.of())).isEqualTo("第一行\n最后一行");
    }

    @Test
    void anEmptyLayerOrFormatVariableAloneOnItsLineTakesTheLineWithIt() {
        String t = "{{base}}\n你是编导。\n{{method}}\n{{format.output}}";
        assertThat(PromptTemplate.render(t, Map.of("base", "", "method", "", "format.output", "只输出 JSON"))).isEqualTo("你是编导。\n只输出 JSON");
        assertThat(PromptTemplate.render(t, Map.of("base", "红线", "method", "电商经验", "format.output", ""))).isEqualTo("红线\n你是编导。\n电商经验\n");
        // an ordinary variable keeps its line even when empty (same as the old fill)
        assertThat(PromptTemplate.render("a\n{{x}}\nb", Map.of())).isEqualTo("a\n\nb");
    }

    @Test
    void namesListsOnlyTopLevelNamesAndSyntaxErrorsAreReported() {
        assertThat(PromptTemplate.names("{{a}}{{#b}}{{c}}{{/b}}{{format.x}}{{#l}}{{.}}{{-last}}{{/l}}")).containsExactly("a", "b", "format.x", "l");
        assertThatThrownBy(() -> PromptTemplate.check("{{#a}}没关")).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("{{/a}}");
        assertThatThrownBy(() -> PromptTemplate.check("{{#a}}{{/b}}")).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("{{/b}}");
    }
}
