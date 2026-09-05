package com.aistareco.aep.identity;

/**
 * 账号中心响应不符合契约（{@code docs/unified-identity-plan.md} §12.3 / §12.4）。
 *
 * <p>存在的理由：此前 {@code IdentityCenterClient} 只认「顶层裸数组」，而账号中心真实返回的是
 * {@code {success:true,data:{events:[…]}}} —— 解析不出来时**静默返回空列表**，
 * 结果是「轮询一直说 0 条、导入一直说导完了」，谁都不知道链路其实从没通过。
 *
 * <p>现在壳不认识就抛：轮询侧游标不前进（下轮重试，并 WARN 出真实响应片段），
 * 导入侧把错误抛回给运维触发的接口。</p>
 */
public class IdentityCenterException extends RuntimeException {

    public IdentityCenterException(String message) {
        super(message);
    }
}
