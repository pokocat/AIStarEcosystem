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
 * <p><b>v0.149 起本类不再是权益真值</b>：能不能进某个子产品由 {@code product_enrollment}
 * （{@code EnrollmentService} / {@code EnrollmentGuard}）说了算，后端真拦。本类退化为
 * 「一把没有声明子应用的全站秘钥，该开通哪些产品」这条**策略**，由
 * {@code EnrollmentService.resolveGrantedProducts} 消费 —— 它拿到 CSV 后既写
 * enrollment 行，也继续双写旧 {@code aep_users.platforms} CSV 作兼容。
 * 无激活码的新账号（账号中心 JIT 建档）走 {@code EnrollmentService.grantForNewUser}：
 * dev-grant-all 时开通全部（source={@code GRANT_ALL}），生产一条都不建。</p>
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
