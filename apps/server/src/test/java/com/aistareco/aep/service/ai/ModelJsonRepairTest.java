package com.aistareco.aep.service.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** 大模型 JSON 输出的闭合符修复：只补由嵌套栈唯一确定的 ] / }，不改字段和值；解释不了的放弃。 */
class ModelJsonRepairTest {

    @Test
    void balancedInput_isReturnedUnchanged() {
        String ok = "{\"a\":[1,{\"b\":2}],\"c\":\"x\"}";
        assertEquals(ok, ModelJsonRepair.repairUnbalancedClosers(ok));
    }

    @Test
    void missingArrayCloserBeforeObjectCloser_isInserted() {
        // looks 的 ] 漏了，下一个 } 是角色的：在它前面补上 ]
        assertEquals("{\"cs\":[{\"looks\":[{\"n\":1}]},{\"n\":2}]}",
                ModelJsonRepair.repairUnbalancedClosers("{\"cs\":[{\"looks\":[{\"n\":1}},{\"n\":2}]}"));
    }

    @Test
    void missingTrailingClosers_areAppendedInNestingOrder() {
        assertEquals("{\"a\":[1,{\"b\":[2]}]}", ModelJsonRepair.repairUnbalancedClosers("{\"a\":[1,{\"b\":[2"));
    }

    @Test
    void closersInsideStrings_andEscapedQuotes_areIgnored() {
        assertEquals("{\"a\":\"}]\\\"[\",\"b\":[1]}",
                ModelJsonRepair.repairUnbalancedClosers("{\"a\":\"}]\\\"[\",\"b\":[1}"));
    }

    @Test
    void unexplainableInput_returnsNull() {
        assertNull(ModelJsonRepair.repairUnbalancedClosers("{\"a\":1]}"), "没有对应开括号的 ]");
        assertNull(ModelJsonRepair.repairUnbalancedClosers("{\"a\":\"停在字符串中间"), "字符串没收尾");
        assertNull(ModelJsonRepair.repairUnbalancedClosers(null));
    }
}
