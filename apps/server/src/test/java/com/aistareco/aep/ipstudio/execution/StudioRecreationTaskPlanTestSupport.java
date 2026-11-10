package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;

/** 给别的包的测试用：H3 一样的合同和复刻方法规则。 */
public final class StudioRecreationTaskPlanTestSupport {
    private StudioRecreationTaskPlanTestSupport() {}
    public static VideoStudioContract h3() {return StudioRecreationTaskPlanTest.h3();}
    public static StudioSkillRules.Rules rules() throws Exception {return StudioRecreationTaskPlanTest.rules();}
}
