package com.aistareco.aep.dap.model;

import com.aistareco.common.JsonMapConverter;
import com.aistareco.common.StringListConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 数字人本体资产（apps/web-aiavatar 契约真源 src/proto/data.ts#Avatar）。
 *
 * 状态机（8 态，wire 小写）：
 *   draft → proofing → iterating/refining → pending → finalized → deriving → archived
 * 文件字段一律存 storage key（§4.7.4），URL 由 DTO 出 wire 时经 FileStorageService 派生。
 */
@Entity
@Table(name = "dap_avatar", indexes = {
        @Index(name = "idx_dap_avatar_owner", columnList = "ownerUserId"),
        @Index(name = "idx_dap_avatar_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapAvatar {

    /** 业务 id，形如 DH-2041，全局唯一、直接暴露给前端。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(length = 128)
    private String codename;

    /** real | ai */
    @Column(nullable = false, length = 8)
    private String path;

    @Column(length = 128)
    private String archetype;

    @Column(length = 256)
    private String tagline;

    /** 8 态状态机（小写 wire 串直存）。 */
    @Column(nullable = false, length = 16)
    private String status;

    @Builder.Default
    private boolean fav = false;

    /** 占位画像色相（真实图片生成前 / 失败时前端渐变底色）。 */
    @Builder.Default
    private int hue = 250;

    @Column(length = 16)
    @Builder.Default
    private String hairStyle = "short";

    /** 关联授权 id（real 路径）。 */
    @Column(length = 32)
    private String licenseId;

    /** true = 占位产物（未配置生成引擎时降级），前端显示 MOCK 角标。 */
    @Builder.Default
    private boolean mock = false;

    @Column(length = 64)
    @Builder.Default
    private String engine = "Agnes Image 2.1";

    /** 占位画像调色板 {bg1,bg2,skin,hair,cloth,accent}。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> palette;

    /** 设定档案（中文键：年龄/气质/用途/性格/服饰/形象来源/设定语）。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> def;

    /** 衍生状态 {atlas|expr|scene|ward|d3|video → empty|draft|running|done|stale}。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> deriv;

    /** 衍生数量 {atlas.. → int}。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> counts;

    @Builder.Default
    private int versions = 1;

    /** 绑定音色名（内置 AI 音色名或我的声线名）。 */
    @Column(length = 64)
    private String voiceName;

    /** 当前定妆主图 storage key。 */
    @Column(length = 512)
    private String imageKey;

    /** 形象生成候选（4 变体）storage keys。 */
    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private List<String> variantKeys = new ArrayList<>();

    /** 标准图集 {shotKey → storage key}。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> shotKeys;

    /** 用户原始人设描述（AI 路径表单）。 */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String descPrompt;

    /** 表单附加项（朝向/姿态/风格/年龄/性别/族裔 等）。 */
    @Convert(converter = JsonMapConverter.class)
    @Column(columnDefinition = "TEXT")
    private Map<String, Object> form;

    /** 英文生成基准 prompt（chat 解析产物，迭代时复用）。 */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String basePrompt;

    /** 定稿美化模板 id。 */
    @Column(length = 32)
    private String templateId;

    /** 该资产累计图片字节数（存储用量统计）。 */
    @Builder.Default
    private long imageBytes = 0;

    private Instant createdAt;
    private Instant updatedAt;

    /** 软删（回收）；列表过滤。 */
    private Instant deletedAt;

    public Map<String, Object> defOrEmpty() { return def != null ? def : new LinkedHashMap<>(); }
    public Map<String, Object> derivOrEmpty() { return deriv != null ? deriv : new LinkedHashMap<>(); }
    public Map<String, Object> countsOrEmpty() { return counts != null ? counts : new LinkedHashMap<>(); }
}
