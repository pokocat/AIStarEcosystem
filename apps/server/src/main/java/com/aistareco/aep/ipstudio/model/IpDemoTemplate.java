package com.aistareco.aep.ipstudio.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * 全局示例 IP 工作流（v0.182）。
 *
 * <p>与内置模板（{@code resources/ipstudio/templates/*.json}）的区别只有一个：**素材已经在里面了**。
 * 内置模板是空工作流，用户得自己拖照片、自己跑一遍才知道这条链能干什么；示例模板是运营把一个
 * 跑完的真实项目「存为全局示例」——照片、每一版成图、成片都随文档一起过来，新用户一进来就看见效果。
 *
 * <p>素材键指向 {@code ipstudio/demo/<id>/…}（平台自有，所有人可读），不是原项目那份属于某个用户的
 * key —— 否则换个人打开就是一片空白，原作者一删账号示例还会跟着烂掉。
 */
@Entity
@Table(name = "ip_demo_template")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
// @Builder.Default 不是可选的：Lombok 的 builder **忽略字段初始值**，
// 不加的话 builder().build() 出来 kind=null（NOT NULL 列，插入直接炸）、
// enabled=false（本意是 true）。现有调用恰好都显式传了或随后 setter 覆盖，
// 属于侥幸 —— 下一个照着 builder 写的人就会踩到。
@Builder
public class IpDemoTemplate {

    @Id
    public static final String KIND_TEMPLATE = "template";
    public static final String KIND_EXAMPLE = "example";

    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(length = 1024)
    private String summary;

    // columnDefinition 必须写死：不写的话 Hibernate 6 按 @Column 默认长度 255 挑到
    // tinytext，一份画布文档瞬间超（v0.179 线上事故，LobColumnDefinitionTest 会拦）。
    @Lob
    @Column(name = "doc_json", nullable = false, columnDefinition = "LONGTEXT")
    private String docJson;

    @Column(name = "cover_key", length = 512)
    private String coverKey;

    /**
     * `template` = 只有工作流（素材已剥掉），进「开始一个 IP」那一排；
     * `example`  = 连素材的成品，进画布列表并标「官方示例」。
     * 存量行按 example（v0.182 起存的都带素材，改判成 template 会让素材凭空消失）。
     */
    @Column(nullable = false, length = 16)
    @Builder.Default
    private String kind = IpDemoTemplate.KIND_EXAMPLE;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @Column(name = "source_project_id", length = 32)
    private String sourceProjectId;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
