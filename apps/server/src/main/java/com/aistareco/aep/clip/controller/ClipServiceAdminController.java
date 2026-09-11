package com.aistareco.aep.clip.controller;

import com.aistareco.aep.clip.dto.ClipDtos.TemplateDto;
import com.aistareco.aep.clip.security.ClipServiceIdentity;
import com.aistareco.aep.clip.service.ClipTemplateService;
import com.aistareco.aep.clip.service.ClipVendorService;
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
 * <p><b>只读 + 上下架，刻意不含创建与整体编辑。</b> 模板的 scriptSkeleton / timeline 是内容创作
 * 产物，不是几个表单字段；给它做一个半吊子的编辑表单，运营一存就可能把配好的片尾和分镜清掉。
 * 创建与整体编辑仍走 {@code /api/admin/clip/templates}（staff JWT），或直接由内容同学导入。
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

    public ClipServiceAdminController(ClipServiceIdentity identity, ClipTemplateService templates, ClipVendorService vendor) {
        this.identity = identity; this.templates = templates; this.vendor = vendor;
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
