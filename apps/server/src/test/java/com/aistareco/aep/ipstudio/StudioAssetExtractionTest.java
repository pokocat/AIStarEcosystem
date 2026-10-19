package com.aistareco.aep.ipstudio;
import com.aistareco.aep.ipstudio.service.StudioAssetExtraction;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class StudioAssetExtractionTest {
    @Test void emptyFrameworkIsNotARealCharacterAndSameNamesRemainDistinctCandidates() {
        var draft="## 人物小传\n### 主角\n身份与外貌：\n性格与目标：\n## 场景设计\n### 主要场景\n地点与时间：";
        assertTrue(StudioAssetExtraction.structured(draft).isEmpty());
        var list=StudioAssetExtraction.structured("## 人物小传\n### 张三\n年轻学生。\n### 张三\n年老的邻居。\n");
        assertEquals(2,list.size());assertNotEquals(list.get(0).key(),list.get(1).key());
    }
    @Test void modelCannotInventEvidenceAndWrappedQuotationRestoresExactSource() throws Exception {
        var om=new ObjectMapper();var result=om.readTree("{\"items\":[{\"key\":\"character:江口\",\"kind\":\"character\",\"name\":\"江口\",\"description\":\"大学生\",\"evidence\":\"江口，男，22岁\"}]}");
        assertEquals("江口，男，\n22岁",StudioAssetExtraction.validate(result,"江口，男，\n22岁").get(0).evidence());
        assertThrows(RuntimeException.class,()->StudioAssetExtraction.validate(result,"江口的年龄没有写明"));
        assertEquals(1,StudioAssetExtraction.validate(result,"旅客江口，男，22岁。" ).size());
        assertEquals("江口，男，22岁",StudioAssetExtraction.sourceQuote("江口，男，22岁。安子住在旅馆。","江口，男，22岁……安子住在旅馆"));
        assertEquals("虚构的陌生人物",StudioAssetExtraction.sourceQuote("江口是旅客。","虚构的陌生人物"));
    }
}
