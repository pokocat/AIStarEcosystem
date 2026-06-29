package com.aistareco.aep.dto;

import java.time.Instant;
import java.util.Map;

/**
 * 支付渠道配置（admin 视图，v0.94）。机密一律脱敏（{@code creds} 的值是 sk-…XXXX 掩码或空），
 * 绝不返回明文。{@code configured} 由后端判定该渠道必填机密是否齐全。
 *
 * @param code           渠道代码
 * @param label          展示名
 * @param enabled        是否启用
 * @param sandbox        是否沙箱
 * @param sortOrder      收银台排序
 * @param defaultWayCode 默认支付方式
 * @param configured     必填机密是否齐全（可下单）
 * @param creds          机密字段（值已脱敏；key 为字段名，供前端表单展示「已配置/未配置」）
 * @param updatedAt      最后更新时间
 * @param updatedBy      最后修改者
 */
public record PaymentChannelConfigDto(
        String code,
        String label,
        boolean enabled,
        boolean sandbox,
        int sortOrder,
        String defaultWayCode,
        boolean configured,
        Map<String, String> creds,
        Instant updatedAt,
        String updatedBy
) {}
