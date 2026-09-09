package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpTemplateDto;
import com.aistareco.aep.ipstudio.model.IpDemoTemplate;
import com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 工作流目录的**唯一**解析口 —— 全局示例（库里的 {@code ip_demo_template}）+ 内置模板（classpath）。
 *
 * <p><b>为什么要有这个类。</b>在此之前，「列目录」和「按 id 建项目」读的是两个不同的源：
 * 控制器的 {@code GET /templates} 把示例和内置模板拼起来返回，而
 * {@code IpProjectService.create} 只查 {@link IpCatalogService}（只有 classpath 内置的）。
 * 于是运营存了一个全局示例之后 —— 目录里看得见，一点就报
 * {@code IP_TEMPLATE_NOT_FOUND：内置工作流不存在}。**列表能列出来的东西，建的时候必须也认得。**
 *
 * <p><b>为什么不直接把示例塞进 {@link IpCatalogService}。</b>
 * {@link IpDemoTemplateService} 依赖 {@code IpProjectService}（存示例要读项目文档），
 * 而 {@code IpProjectService} 要用解析结果 —— 直接互相注入就是循环依赖。
 * 所以这里只依赖 <b>repository</b>（无业务依赖）而不是那个 service，环就断了。
 *
 * <p>顺序：示例排在内置模板前面（运营精选的东西优先给用户看到）。
 */
@Service
public class IpTemplateResolver {

    private static final Logger log = LoggerFactory.getLogger(IpTemplateResolver.class);

    private final IpCatalogService catalog;
    private final IpDemoTemplateRepository demoRepo;
    private final FileStorageService storage;
    private final ObjectMapper om;

    public IpTemplateResolver(IpCatalogService catalog, IpDemoTemplateRepository demoRepo,
                              FileStorageService storage, ObjectMapper om) {
        this.catalog = catalog;
        this.demoRepo = demoRepo;
        this.storage = storage;
        this.om = om;
    }

    /**
     * 「开始一个 IP」那一排：全局**模板** + 内置模板。
     *
     * <p>v0.192 起只列 {@code kind=template} —— 带素材的**实例**不在这里，
     * 它们进画布列表（{@link #listExamples()}）。两者用户意图不同：
     * 模板是「拿它当起点、填我自己的素材」，实例是「点开看看做完长什么样」。
     */
    public List<IpTemplateDto> list() {
        List<IpTemplateDto> out = new ArrayList<>();
        for (IpDemoTemplate d : demoRepo
                .findByKindAndEnabledTrueOrderBySortOrderAscCreatedAtAsc(IpDemoTemplate.KIND_TEMPLATE)) {
            out.add(toDto(d));
        }
        out.addAll(catalog.templates());
        return out;
    }

    /** 全局**实例**（带素材的成品）—— 画布列表里那一批「官方示例」。 */
    public List<IpTemplateDto> listExamples() {
        List<IpTemplateDto> out = new ArrayList<>();
        for (IpDemoTemplate d : demoRepo
                .findByKindAndEnabledTrueOrderBySortOrderAscCreatedAtAsc(IpDemoTemplate.KIND_EXAMPLE)) {
            out.add(toDto(d));
        }
        return out;
    }

    /**
     * 按 id 解析一个工作流。**先查示例再查内置** —— 与 {@link #list()} 同一套来源与顺序，
     * 这正是这个类存在的意义：两边不会再各读各的。
     *
     * <p>注意这里查的是**启用中**的示例：目录里下线了的，建项目时也不该还能建出来。
     */
    public Optional<IpTemplateDto> resolve(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        String want = id.trim();
        // 这里**两种都要认**：点一个实例是「照它复制一份到我的画布」，
        // 走的也是「按 id 建项目」这条路。只认模板的话，实例点了就报不存在。
        for (IpDemoTemplate d : demoRepo.findByEnabledTrueOrderBySortOrderAscCreatedAtAsc()) {
            if (want.equals(d.getId())) return Optional.of(toDto(d));
        }
        return catalog.template(want);
    }

    private IpTemplateDto toDto(IpDemoTemplate d) {
        return new IpTemplateDto(
                d.getId(),
                d.getName(),
                d.getSummary() == null ? "" : d.getSummary(),
                d.getCoverKey() == null ? "" : signOrEmpty(d.getCoverKey()),
                null, 0, 0,
                docOf(d));
    }

    /** 示例文档 → JSON 树；坏了就当空画布（一个示例坏掉不该让整个目录打不开）。 */
    private JsonNode docOf(IpDemoTemplate row) {
        try {
            JsonNode n = om.readTree(row.getDocJson());
            return n != null && n.isObject() ? n : IpDocs.emptyDoc(om);
        } catch (Exception e) {
            log.warn("[ipstudio] 示例文档解析失败 demo={}: {}", row.getId(), e.getMessage());
            return IpDocs.emptyDoc(om);
        }
    }

    /** 封面签不出来只是少一张缩略图，不该让整个目录挂掉。 */
    private String signOrEmpty(String key) {
        try {
            String url = storage.signedUrl(key);
            return url == null ? "" : url;
        } catch (RuntimeException e) {
            return "";
        }
    }
}
