package com.aistareco.aep.enrollment.event;

/**
 * 某账号的某个子产品刚被开通（激活码兑换成功）。
 *
 * <p>用 Spring 应用事件而不是直接调账号中心客户端，是为了让「开通」与「回报账号中心链接状态」
 * 解耦：统一账号中心那条线只要 {@code @EventListener} 监听本事件，
 * best-effort 调 {@code PUT /api/products/aistar/links/{uid}} 把 link 置 ACTIVE 即可
 * （docs/unified-identity-plan.md §12.2 最后一句），开通链路不因外部服务抖动而失败。</p>
 *
 * @param userId  本地账号 id（{@code aep_users.id}）
 * @param product 子产品 key（music / drama / celebrity / aiavatar / star）
 */
public record EnrollmentActivatedEvent(String userId, String product) {}
