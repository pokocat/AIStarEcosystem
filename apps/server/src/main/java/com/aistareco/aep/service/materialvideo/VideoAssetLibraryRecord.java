package com.aistareco.aep.service.materialvideo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.Instant;

/** 一个素材库对应一个供应商账号，同一账号下的模型共用，同一张图不用传两次。密钥不放这里。 */
@Data
@Entity
@Table(name = "video_asset_library")
public class VideoAssetLibraryRecord {
    @Id @Column(length = 64) private String id;
    @Column(nullable = false, length = 128) private String name;
    /** 用哪个适配器：现在只有 {@code onetoken}。 */
    @Column(nullable = false, length = 32) private String adapter;
    @Column(name = "config_json", nullable = false, columnDefinition = "TEXT") private String configJson;
    @Column(nullable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
}
