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
        assertDoesNotThrow(()->StudioNaturalApprovals.require("可以，按推荐的做，上限 150",card,150,0),"a lower cap is fine when the user said it");
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

    /** R2-01: a deferral or an edit request is not an approval even when the model calls the tool. */
    @Test void deferralsAndEditRequestsNeverApprove() {
        for(String text:new String[]{"只修改方案，生成等我通知","先改一下第二段再说","按这个方案，但先不生成","等我确认再开始","改成横屏，开始前再问我","好的，稍后再说"}) {
            var e=assertThrows(BusinessException.class,()->StudioNaturalApprovals.require(text,card,200,0),text);
            assertEquals("STUDIO_APPROVAL_AMBIGUOUS",e.getCode(),text);
        }
        assertEquals("STUDIO_APPROVAL_AMBIGUOUS",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require("洗衣液换成蓝色包装",card,200,0)).getCode(),
                "a message naming neither approval nor hesitation is not an approval");
    }

    /** R2-02: the user's own number wins; the model may neither raise nor round it, in either direction. */
    @Test void theUsersNumberCannotBeOverriddenByTheModel() {
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require("按这个方案开始，上限280积分",card,300,0)).getCode(),
                "280 said, 300 passed: refused although 300 is below the card's 1000");
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require("按这个方案开始，上限280积分",card,200,0)).getCode(),
                "280 said, model fell back to the card's proposal: refused");
        assertDoesNotThrow(()->StudioNaturalApprovals.require("按这个方案开始，上限280积分",card,280,0));
        assertDoesNotThrow(()->StudioNaturalApprovals.require("开始，预算不超过 1,500",card,1500,0));
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require("开始吧",card,150,0)).getCode(),
                "a cap the card did not propose and the user did not say is refused even when lower");
        assertDoesNotThrow(()->StudioNaturalApprovals.require("开始吧",card,200,0),"the card's own proposal needs no number");
    }

    /** R3-01: a redo figure the user named never stands in for the total cap, and the reverse. */
    @Test void eachNamedAmountBindsItsOwnCap() {
        String both="按这个方案开始，总上限280积分，重做上限0积分";
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require(both,card,200,0)).getCode(),
                "redo 0 matched, but the total 200 is not the 280 the user said");
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require(both,card,1000,0)).getCode());
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require(both,card,280,20)).getCode(),
                "the user said redo 0; 20 is refused");
        assertDoesNotThrow(()->StudioNaturalApprovals.require(both,card,280,0));
        assertDoesNotThrow(()->StudioNaturalApprovals.require("开始，上限 500，重做额度 100",card,500,100));
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->StudioNaturalApprovals.require("开始，上限 500，重做额度 100",card,100,100)).getCode(),
                "the redo figure cannot be reused as the total");
    }
}
