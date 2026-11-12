package com.aistareco.aep.service.materialvideo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.Instant;

/** 一个素材库对应一个供应商账号，同一账号下的模型共用，同一张图不用传两次。官方素材库的凭据单独加密保存。 */
@Data
@Entity
@Table(name = "video_asset_library")
public class VideoAssetLibraryRecord {
    @Id @Column(length = 64) private String id;
    @Column(nullable = false, length = 128) private String name;
    /** 用哪个适配器：{@code onetoken} / {@code ark}。 */
    @Column(nullable = false, length = 32) private String adapter;
    @Column(name = "config_json", nullable = false, columnDefinition = "TEXT") private String configJson;
    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "credential_encrypted", columnDefinition = "TEXT")
    @lombok.ToString.Exclude private String credentialEncrypted;
    @Column(nullable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "portrait_upload_after", insertable = false, updatable = false)
    private Instant portraitUploadAfter;
}
