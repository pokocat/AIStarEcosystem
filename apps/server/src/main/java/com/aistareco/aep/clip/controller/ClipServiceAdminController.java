package com.aistareco.aep.clip.controller;

import com.aistareco.aep.clip.dto.ClipDtos.TemplateDto;
import com.aistareco.aep.clip.security.ClipServiceIdentity;
import com.aistareco.aep.clip.service.ClipTemplateService;
import com.aistareco.aep.clip.service.ClipVendorService;
import com.aistareco.aep.clip.service.ClipPricingService;
import com.aistareco.aep.clip.dto.ClipVendorDtos.VendorOverviewDto;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

/**
 * 军师运营后台专用的 clip 运营面：**service token 鉴权**，不是 staff JWT。
 *
 * <p>为什么要另开一条路径，而不是直接用 {@link AdminClipController}：那一条挂在 {@code /api/admin/**}
 * 下，SecurityConfig 要求 {@code hasAnyRole(SUPER_ADMIN, OPERATOR, FINANCE_ADMIN)} —— 也就是一枚
 * AIStar 的后台人员 JWT。军师 BFF 手里只有 clip service token（服务间共享密钥），调过去必然 403。
 * 让 BFF 去存一份 AIStar 的后台账号密码再登录换 JWT，是把两个系统的账号生命周期绑死，
 * 换个密码就断链，不划算。
 *
 * <p>爱速拍的模板货架在此之前**没有任何控制台** —— {@code /api/admin/clip/templates} 这几条接口
 * 存在，但全仓没有一处前端调它，运营要上下架一个模板只能 curl + 手搓 JWT。而模板就是爱速拍的
 * 首页，内容即产品，上下架是最高频的运营动作。这条路径就是为了把那个动作接进军师运营后台
 * （后台是一个、按产品分区，见 ai-pilot/admin/src/nav.ts）。
 *
 * <p><b>建模板的方式是「把自己做好的草稿存下来」，不是填表。</b> scriptSkeleton / timeline
 * 是内容创作产物，做成表单的话运营一存就可能把配好的片尾和分镜清掉。所以这里给的是
 * {@code POST /templates/from-project}（照搬 ip studio 的 publish-as-demo）：在小程序里把片子
 * 做顺，回后台一键沉淀，素材与数字人 / 声音由服务端剥干净。逐字段的整体编辑仍走
 * {@code /api/admin/clip/templates}（staff JWT）。
 *
 * <p><b>密钥影响面</b>：这条路径让 clip service token 的能力从「某个 owner 的 clip 数据」扩大到
 * 「全站模板的上下架」。token 只在服务端之间流转，且军师 BFF 侧还压了两道闸
 * （requireProductAccess(quickreel) + 写操作 requireSuper）。但这一点必须写明，
 * 不能让后来的人以为这个 token 还只是「某个用户的数据」那个量级。
 */
@RestController
@RequestMapping("/api/service/clip/admin")
public class ClipServiceAdminController {
    private final ClipServiceIdentity identity;
    private final ClipTemplateService templates;
    private final ClipVendorService vendor;
    private final ClipPricingService pricing;

    public ClipServiceAdminController(ClipServiceIdentity identity, ClipTemplateService templates,
                                      ClipVendorService vendor, ClipPricingService pricing) {
        this.identity = identity; this.templates = templates; this.vendor = vendor; this.pricing = pricing;
    }

    /**
     * 校验 service token。
     *
     * <p>沿用 {@link ClipServiceIdentity#require} 而不是另写一套：它做的是常量时间比较
     * （MessageDigest.isEqual），另写很容易退化成 {@code equals} 而引入时序侧信道。
     * 代价是它同时要求一个合法的 owner id —— 运营动作本来没有属主，所以 BFF 会带一个
     * 固定的哨兵值过来。这里不用那个值，只借它的校验。
     */
    private void auth(String authorization, String owner, String tenant) {
        identity.require(authorization, owner, tenant);
    }

    /** 全部模板（含未上架的）。运营要看见草稿才知道有什么可以上。 */
    @GetMapping("/templates")
    public ApiResponse<List<TemplateDto>> templates(
            @RequestHeader(value = "Authorization", required = false) String a,
            @RequestHeader(value = "X-External-Owner-Id", required = false) String o,
            @RequestHeader(value = "X-External-Tenant-Id", required = false) String t) {
        auth(a, o, t);
        return ApiResponse.of(templates.adminList());
    }

    /**
     * 上架 / 下架。只改这一个字段，见 {@link ClipTemplateService#setStatus}。
     *
     * <p>不做成 PUT 整份模板：那条路径是整体替换语义，运营点一下「上架」却要回传整份文档，
     * 中间任何一次并发编辑都会被覆盖，漏传一个字段就静默清空配好的片尾。
     */
    @PutMapping("/templates/{id}/status")
    public ApiResponse<TemplateDto> setStatus(
            @RequestHeader(value = "Authorization", required = false) String a,
            @RequestHeader(value = "X-External-Owner-Id", required = false) String o,
            @RequestHeader(value = "X-External-Tenant-Id", required = false) String t,
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        auth(a, o, t);
        return ApiResponse.of(templates.setStatus(id, String.valueOf(body == null ? "" : body.get("status"))));
    }

    /**
     * 把一条**自己的**草稿存成模板 —— 运营在小程序里把片子做顺了，回后台一键沉淀成货架上的一套。
     *
     * <p>形制照搬 ip studio 的 {@code publish-as-demo}。{@code externalOwnerId} 走
     * {@code X-External-Owner-Id} 头：军师 BFF 会把**当前运营自己的用户 id** 带过来，
     * 不是那个哨兵值 —— 只能存自己的草稿，运营也不该凭一个 id 就把别人的草稿抄成公开模板。
     *
     * <p>body：{@code { projectId, name, industry, themeKey, description, templateId?, keepText? }}
     *
     * <p><b>一律存成草稿</b>，存完要自己再点一次上架。存模板和上架是两个决定 ——
     * 直接 published 的话，一次手滑就推给了全平台每一个用户。
     */
    @PostMapping("/templates/from-project")
    public ApiResponse<TemplateDto> publishFromProject(
            @RequestHeader(value = "Authorization", required = false) String a,
            @RequestHeader(value = "X-External-Owner-Id", required = false) String o,
            @RequestHeader(value = "X-External-Tenant-Id", required = false) String t,
            @RequestBody Map<String, Object> body) {
        var owner = identity.require(a, o, t);
        return ApiResponse.of(templates.publishFromProject(
                owner.externalOwnerId(),
                textOf(body, "projectId"),
                textOf(body, "templateId"),
                textOf(body, "name"), textOf(body, "industry"),
                textOf(body, "themeKey"), textOf(body, "description"),
                // 缺省保留正文：运营写的示范文案本身就是模板的价值。
                !Boolean.FALSE.equals(body == null ? null : body.get("keepText"))));
    }

    /**
     * 六档生成单价：当前生效值 + 是不是运营核定过的。
     *
     * <p>{@code configured=false} 表示库里还没有那一行，现在用的是 application.yml 的兜底值 ——
     * 后台必须把这件事显式写在页面上，否则运营会以为这六个数是有人定过的。
     */
    @GetMapping("/pricing")
    public ApiResponse<Map<String, Object>> pricing(
            @RequestHeader(value = "Authorization", required = false) String a,
            @RequestHeader(value = "X-External-Owner-Id", required = false) String o,
            @RequestHeader(value = "X-External-Tenant-Id", required = false) String t) {
        auth(a, o, t);
        var p = pricing.resolved();
        return ApiResponse.of(Map.of(
                "creditPerAvatarSecond", p.creditPerAvatarSecond(),
                "creditPerImage", p.creditPerImage(),
                "creditPerT2vSecond", p.creditPerT2vSecond(),
                "creditPerI2vSecond", p.creditPerI2vSecond(),
                "creditPerAssemble", p.creditPerAssemble(),
                "creditPerKChar", p.creditPerKChar(),
                "configured", pricing.configured()));
    }

    /**
     * 整组核定六档单价。**六个一起给**，不接受只改其中几个 —— 只改一档会把另外五档
     * 「没人核定过的配置兜底值」一并升格成「运营配过的价」（见 ClipPricingService.save）。
     *
     * <p>军师 BFF 侧还压着 requireSuper + requireProductAccess('editor')，并落审计。
     */
    @PutMapping("/pricing")
    public ApiResponse<Map<String, Object>> savePricing(
            @RequestHeader(value = "Authorization", required = false) String a,
            @RequestHeader(value = "X-External-Owner-Id", required = false) String o,
            @RequestHeader(value = "X-External-Tenant-Id", required = false) String t,
            @RequestBody Map<String, Object> body) {
        auth(a, o, t);
        pricing.save(textOf(body, "operator"),
                intOf(body, "creditPerAvatarSecond"), intOf(body, "creditPerKChar"),
                intOf(body, "creditPerAssemble"), intOf(body, "creditPerImage"),
                intOf(body, "creditPerT2vSecond"), intOf(body, "creditPerI2vSecond"));
        return pricing(a, o, t);
    }

    /** body 里的字符串。缺字段给 null，不要给字面量 "null" —— 那会被当成操作者名字写进审计列。 */
    private static String textOf(Map<String, Object> body, String key) {
        Object v = body == null ? null : body.get(key);
        String s = v == null ? "" : String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    /** body 里的整数。缺字段返回 null，由 ClipPricingService.save 统一报「要 0 到 100 万之间的整数」。 */
    private static Integer intOf(Map<String, Object> body, String key) {
        Object v = body == null ? null : body.get(key);
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String str && str.matches("-?\\d{1,9}")) return Integer.parseInt(str);
        return null;
    }

    /**
     * 石榴 AI 供应商总览：额度快照 + 上游对象清单 + 与我方 DB 的三类对账。**只读**。
     *
     * <p>实时打上游、不走缓存，所以别放进任何轮询里。清理孤儿 / 悬挂要连本地记录与素材一起处理，
     * 不在这里做（同 {@link AdminClipController#vendorOverview}）。
     */
    @GetMapping("/vendor/overview")
    public ApiResponse<VendorOverviewDto> vendorOverview(
            @RequestHeader(value = "Authorization", required = false) String a,
            @RequestHeader(value = "X-External-Owner-Id", required = false) String o,
            @RequestHeader(value = "X-External-Tenant-Id", required = false) String t) {
        auth(a, o, t);
        return ApiResponse.of(vendor.overview());
    }
}
