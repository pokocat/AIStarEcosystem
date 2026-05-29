package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 素材运营 · 脚本资产（前端真值源：apps/web-celebrity material-ops ScriptAsset）。
 * 采用「关键列 + JSON payload」存法（与 MixcutTemplate 的 *_json 列同惯例）：
 *   - 关键列（productId / kind / tier / category）用于关联与筛选；
 *   - payloadJson 存完整 ScriptAsset（blocks / metrics / source 等），出 wire 时整体回放。
 * productId 关联到 products 表 —— 与商品库领域集成。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "material_scripts")
public class MaterialScript {

    @Id
    private String id;

    /** 关联商品（products.id）。 */
    @Column(name = "product_id")
    private String productId;

    /** my_script | template | viral_clone | ai_seed */
    @Column(nullable = false)
    private String kind;

    /** S | A | B | D */
    @Column(nullable = false)
    private String tier;

    @Column
    private String category;

    @Column(name = "hook_type")
    private String hookType;

    @Column(name = "duration_sec")
    @Builder.Default
    private int durationSec = 0;

    /** 排序用：插入序号（值越小越靠前；列表默认按此升序）。 */
    @Column(name = "ord")
    @Builder.Default
    private int ord = 0;

    /**
     * 归属人（AepUser.id）。
     *  - 个人脚本（kind=my_script）：= created_by，仅本人可见。
     *  - 共享脚本（template / viral_clone / ai_seed）：null，全员可见。
     * 列表按「ownerUserId IS NULL OR = 当前用户」过滤。
     */
    @Column(name = "owner_user_id")
    private String ownerUserId;

    /** 软删除时间；列表 / 详情默认过滤。 */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    /** 完整 ScriptAsset JSON（snake_case 字段，前端直接消费）。 */
    @Lob
    @Column(name = "payload_json", columnDefinition = "LONGTEXT", nullable = false)
    private String payloadJson;
}
