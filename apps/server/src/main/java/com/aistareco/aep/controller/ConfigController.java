package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * 平台配置公开读取接口：/api/config/*。
 *
 * <p>安全配置已将 {@code /api/config/**} 列为 permitAll —— 任何人不登录就能读。
 * 所以这里**只吐白名单前缀内的 key**（{@link #PUBLIC_KEY_PREFIXES}）：
 * 那些是前端登录前就要用的「界面字典 / 明码单价」，本身不含任何账号信息。
 *
 * <p><b>为什么必须收窄</b>：{@code aep_platform_configs} 是全站通用的键值表，
 * 里面还放着运维内部状态（如 {@code identity.outbox.cursor} / {@code identity.outbox.deadletter}
 * ——后者曾把账号中心的 uid 与异常堆栈原文写进去）、种子版本号、存储配额等。
 * 从前 {@code GET /api/config} 把整张表全量返回给匿名访客，等于把内部状态挂在公网上。
 *
 * <p>白名单外的 key 一律**当作不存在**（404），不区分「无权限」与「不存在」——
 * 避免匿名探测出哪些内部 key 存在。运营要看全量请走 {@code /api/admin/platform-configs}
 * （SUPER_ADMIN / OPERATOR，行为不变）。
 *
 * <p>新增一个「前端登录前要读」的配置时，把它的前缀加进 {@link #PUBLIC_KEY_PREFIXES}，
 * 并在注释里写清是谁在读 —— 这个名单是「例外」，不是「默认」。
 */
@RestController
@RequestMapping("/api/config")
public class ConfigController {

    /**
     * 允许匿名读取的 key 前缀（当前调用方已核对）：
     * <ul>
     *   <li>{@code incubation.} —— web-music 数字人孵化向导的选项字典与明码单价
     *       （{@code IncubationWizardV2} 走 {@code ConfigApi.getConfig}）。</li>
     *   <li>{@code forge.} —— 形象锻造面板的滑杆 / 发型 / 配色等纯 UI 字典。</li>
     *   <li>{@code drama.credit.} —— 短剧各动作的明码积分单价（登录后另有
     *       {@code GET /api/me/drama/config} 汇总口径；这里保留公开可查，价目表本身不是秘密）。</li>
     * </ul>
     * 注意每条都必须以 {@code .} 结尾：按「前缀 + 点」匹配，避免 {@code incubation-secret.x}
     * 这类同前缀异语义 key 被误放。
     */
    public static final List<String> PUBLIC_KEY_PREFIXES = List.of(
            "incubation.",
            "forge.",
            "drama.credit.");

    private final PlatformConfigService service;

    public ConfigController(PlatformConfigService service) {
        this.service = service;
    }

    /** 该 key 是否允许匿名读取。 */
    public static boolean isPublicKey(String key) {
        if (key == null || key.isBlank()) return false;
        for (String prefix : PUBLIC_KEY_PREFIXES) {
            if (key.startsWith(prefix) && key.length() > prefix.length()) return true;
        }
        return false;
    }

    @GetMapping("/{key}")
    public ApiResponse<PlatformConfigDto> getByKey(@PathVariable String key) {
        if (!isPublicKey(key)) {
            // 与「真的不存在」同形状：不泄露内部 key 是否存在。
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "config not found: " + key);
        }
        return ApiResponse.of(service.requireByKey(key));
    }

    @GetMapping
    public ApiResponse<List<PlatformConfigDto>> listAll() {
        return ApiResponse.of(service.listAll().stream()
                .filter(c -> isPublicKey(c.key()))
                .toList());
    }
}
