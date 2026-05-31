package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.dto.AiAvatarAssetDto;
import com.aistareco.aep.aiavatar.model.AiAvatarAsset;
import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import com.aistareco.aep.aiavatar.repository.AiAvatarAssetRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 资产服务：用户上传图片（普通 / 加密原始照片）、按 avatar / version 列资产、解密下载。
 */
@Service
public class AiAvatarAssetService {

    private final AiAvatarAssetRepository assetRepo;
    private final AiAvatarStorage storage;
    private final AiAvatarCryptoStore cryptoStore;
    private final ObjectMapper mapper;

    public AiAvatarAssetService(AiAvatarAssetRepository assetRepo, AiAvatarStorage storage,
                          AiAvatarCryptoStore cryptoStore, ObjectMapper mapper) {
        this.assetRepo = assetRepo;
        this.storage = storage;
        this.cryptoStore = cryptoStore;
        this.mapper = mapper;
    }

    /** 普通图片上传（参考图 / 已编辑结果回传等）。 */
    public AiAvatarAsset uploadImage(String userId, String avatarId, AiAvatarAssetKind kind, MultipartFile file) {
        validateImage(file);
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw BusinessException.badRequest("AIAVATAR_UPLOAD_FAILED", "读取上传文件失败");
        }
        String ext = extOf(file.getOriginalFilename(), "png");
        AiAvatarStorage.StoredFile sf = storage.writeBytes(data, userId, ext, file.getContentType());
        // 探测尺寸
        int[] wh = imageSize(data);
        AiAvatarAsset a = AiAvatarAsset.builder()
                .id(UUID.randomUUID().toString())
                .avatarId(avatarId)
                .ownerUserId(userId)
                .kind(kind == null ? AiAvatarAssetKind.REFERENCE_IMAGE : kind)
                .fileUrl(sf.url())
                .thumbnailUrl(sf.url())
                .mimeType(file.getContentType())
                .width(wh[0])
                .height(wh[1])
                .fileSize(sf.bytes())
                .engine("upload")
                .encrypted(false)
                .createdAt(OffsetDateTime.now())
                .build();
        return assetRepo.save(a);
    }

    /** 真人原始照片上传（加密存储 + 不暴露明文 URL；fileUrl 指向脱敏预览）。 */
    public AiAvatarAsset uploadSourcePhoto(String userId, String avatarId, MultipartFile file) {
        validateImage(file);
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw BusinessException.badRequest("AIAVATAR_UPLOAD_FAILED", "读取上传文件失败");
        }
        AiAvatarCryptoStore.Encrypted enc = cryptoStore.encryptToBlob(data, userId);

        // 脱敏预览（降采样）落普通区供 UI 展示，不泄露原图细节
        String previewUrl = null;
        var masked = cryptoStore.maskedPreview(data, 256);
        if (masked != null) {
            previewUrl = storage.writeImagePng(masked, userId).url();
        }

        AiAvatarAsset a = AiAvatarAsset.builder()
                .id(UUID.randomUUID().toString())
                .avatarId(avatarId)
                .ownerUserId(userId)
                .kind(AiAvatarAssetKind.SOURCE_PHOTO)
                .fileUrl(previewUrl != null ? previewUrl : "")
                .thumbnailUrl(previewUrl)
                .mimeType(file.getContentType())
                .width(enc.width())
                .height(enc.height())
                .fileSize(data.length)
                .engine("upload")
                .encrypted(true)
                .metaJson("{\"encKey\":\"" + enc.encKey() + "\"}")
                .createdAt(OffsetDateTime.now())
                .build();
        return assetRepo.save(a);
    }

    /** 解密读取原始照片字节（仅 owner 校验后调用）。 */
    public byte[] decryptSourcePhoto(String assetId, String userId) {
        AiAvatarAsset a = assetRepo.findByIdAndOwnerUserId(assetId, userId)
                .orElseThrow(() -> BusinessException.notFound("AIAVATAR_ASSET_NOT_FOUND", "资产不存在"));
        if (!a.isEncrypted() || a.getMetaJson() == null) {
            throw BusinessException.badRequest("AIAVATAR_NOT_ENCRYPTED", "该资产非加密资产");
        }
        try {
            String encKey = mapper.readTree(a.getMetaJson()).path("encKey").asText();
            return cryptoStore.decryptBlob(encKey);
        } catch (Exception e) {
            throw new BusinessException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "AIAVATAR_DECRYPT_FAILED", "解密失败");
        }
    }

    public AiAvatarAsset requireOwned(String assetId, String userId) {
        return assetRepo.findByIdAndOwnerUserId(assetId, userId)
                .orElseThrow(() -> BusinessException.notFound("AIAVATAR_ASSET_NOT_FOUND", "资产不存在"));
    }

    public List<AiAvatarAssetDto> listForAvatar(String avatarId) {
        return assetRepo.findByAvatarIdOrderByCreatedAtDesc(avatarId)
                .stream().map(a -> AiAvatarAssetDto.from(a, mapper)).toList();
    }

    public AiAvatarAssetDto toDto(AiAvatarAsset a) {
        return AiAvatarAssetDto.from(a, mapper);
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("AIAVATAR_EMPTY_FILE", "上传文件为空");
        }
        if (file.getSize() > 50L * 1024 * 1024) {
            throw BusinessException.badRequest("AIAVATAR_FILE_TOO_LARGE", "图片不能超过 50MB");
        }
        String ct = file.getContentType();
        if (ct != null && !ct.startsWith("image/")) {
            throw BusinessException.badRequest("AIAVATAR_NOT_IMAGE", "仅支持图片文件");
        }
    }

    private int[] imageSize(byte[] data) {
        try {
            var img = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(data));
            if (img != null) return new int[]{img.getWidth(), img.getHeight()};
        } catch (Exception ignore) {}
        return new int[]{0, 0};
    }

    private String extOf(String filename, String def) {
        if (filename == null) return def;
        int i = filename.lastIndexOf('.');
        if (i < 0 || i == filename.length() - 1) return def;
        return filename.substring(i + 1).toLowerCase().replaceAll("[^a-z0-9]", "");
    }
}
