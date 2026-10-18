package com.aistareco.aep.ipstudio.execution;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** D04: the server refuses non-approvals and numbers the user never said; refusals leave the card usable. */
class StudioNaturalApprovalsTest {
    final ObjectNode card=new ObjectMapper().createObjectNode().put("stage","analysis").put("quotedCost",30).put("budgetCap",200).put("autoFixCap",0);

    @Test void questionsAndHesitationNeverApprove() {
        for(String text:new String[]{"这个要多少钱？","能便宜点吗","先别开始","我再想想","等等，换个商品","", "  "}) {
            var e=assertThrows(BusinessException.class,()->StudioNaturalApprovals.require(text,card,200,0),text);
            assertEquals("STUDIO_APPROVAL_AMBIGUOUS",e.getCode(),text);
        }
        assertDoesNotThrow(()->StudioNaturalApprovals.require("就按这个开始",card,200,0));
        assertDoesNotThrow(()->StudioNaturalApprovals.require("可以，按推荐的做",card,150,0),"a lower cap than the card is the user's choice");
    }

    @Test void capsAboveTheCardNeedTheUsersOwnNumber() {
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require("开始吧",card,500,0)).getCode());
        assertDoesNotThrow(()->StudioNaturalApprovals.require("开始吧，上限 500 积分",card,500,0));
        assertDoesNotThrow(()->StudioNaturalApprovals.require("上限1,500，开始",card,1500,0),"digit grouping is the same number");
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require("上限 15000，开始",card,1500,0)).getCode(),
                "15000 does not say 1500");
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require("开始，上限 200",card,200,50)).getCode(),
                "a redo budget the card did not propose needs the user's number");
        assertEquals("STUDIO_PLAN_BUDGET_EXCEEDED",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require("开始，上限 20",card,20,0)).getCode(),
                "never below the quote");
    }
}
