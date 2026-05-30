package com.aistareco.aep.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 子产品平台访问授权策略（v0.43+）。
 *
 * <ul>
 *   <li>{@code dev-grant-all=true}（默认开发态）：任意注册入口都授予全部子产品
 *       （music / drama / celebrity）——「一个平台注册，3 个平台都能用」。</li>
 *   <li>{@code dev-grant-all=false}（生产收紧）：只授予注册来源那个子产品；
 *       其余子产品需另行开通。</li>
 * </ul>
 *
 * 真正的访问拦截在前端（各子产品 workspace 布局按 /api/me 返回的 platforms 判断）；
 * 后端这里只负责「注册时授予哪些平台」这一条策略。
 */
@Service
public class PlatformAccessService {

    @Value("${aep.platform.dev-grant-all:true}")
    private boolean devGrantAll;

    /** 计算一个新账号应授予的平台 CSV。registeringPlatform 可为 null（来源未知）。 */
    public String grantedCsvForNewUser(String registeringPlatform) {
        if (devGrantAll) {
            return PlatformSupport.toCsv(PlatformSupport.ALL);
        }
        String p = registeringPlatform == null ? null : registeringPlatform.trim().toLowerCase();
        if (p != null && PlatformSupport.ALL.contains(p)) {
            return PlatformSupport.toCsv(List.of(p));
        }
        // 来源未知且非 grant-all：兜底给全集（避免新用户登录即被锁在门外）。
        return PlatformSupport.toCsv(PlatformSupport.ALL);
    }

    public boolean isDevGrantAll() {
        return devGrantAll;
    }
}
