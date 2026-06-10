package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapDerivativeRepository;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;

import java.util.Set;

/**
 * 供 aep 主域（DigitalIp 艺人壳等）解析 AiAvatar 数字人引用 → 展示名 + 签名图 URL。
 *
 * v0.60 收敛规则：子应用（music/drama）的艺人形象统一引用 dap 数字人，不复制资产；
 * 展示图指针 {@code dapDisplayRef} 格式：
 *   - null / 空        → 跟随数字人定妆照（DapAvatar.imageKey，永远最新）
 *   - "look:&lt;id&gt;"  → 指定造型（DapLook.imageKey）
 *   - "deriv:&lt;id&gt;" → 指定衍生图（DapDerivative.fileKey，仅图片类 kind）
 * 解析失败（资产被删 / 数字人进回收站）一律静默回退，不阻断列表渲染。
 */
@Service
public class DapAvatarRefResolver {

    /** 可作展示图的衍生物 kind（排除 d3 模型 / video 视频）。 */
    private static final Set<String> IMAGE_DERIV_KINDS = Set.of("atlas", "expr", "scene", "ward");

    private final DapAvatarRepository avatarRepo;
    private final DapLookRepository lookRepo;
    private final DapDerivativeRepository derivRepo;
    private final FileStorageService storage;

    public DapAvatarRefResolver(DapAvatarRepository avatarRepo,
                                DapLookRepository lookRepo,
                                DapDerivativeRepository derivRepo,
                                FileStorageService storage) {
        this.avatarRepo = avatarRepo;
        this.lookRepo = lookRepo;
        this.derivRepo = derivRepo;
        this.storage = storage;
    }

    /** 解析结果（数字人不存在/已删时两个字段都为 null，前端回退占位）。 */
    public record View(String avatarName, String displayImageUrl) {
        public static final View EMPTY = new View(null, null);
    }

    /** 出 wire 解析：永不抛错。 */
    public View resolve(String dapAvatarId, String dapDisplayRef) {
        if (dapAvatarId == null || dapAvatarId.isBlank()) return View.EMPTY;
        DapAvatar avatar = avatarRepo.findById(dapAvatarId).orElse(null);
        if (avatar == null || avatar.getDeletedAt() != null) return View.EMPTY;
        String key = resolveKey(avatar, dapDisplayRef);
        String url = null;
        if (key != null && !key.isBlank()) {
            try {
                url = storage.signedUrl(key);
            } catch (RuntimeException ignore) {
                // 签名失败不阻断（可用性优先，§8.0 观测类例外同理）
            }
        }
        return new View(avatar.getName(), url);
    }

    private String resolveKey(DapAvatar avatar, String ref) {
        if (ref != null && !ref.isBlank()) {
            if (ref.startsWith("look:")) {
                String key = lookRepo.findById(ref.substring(5))
                        .filter(l -> avatar.getId().equals(l.getAvatarId()))
                        .map(l -> l.getImageKey())
                        .orElse(null);
                if (key != null) return key;
            } else if (ref.startsWith("deriv:")) {
                String key = derivRepo.findById(ref.substring(6))
                        .filter(d -> avatar.getId().equals(d.getAvatarId()))
                        .map(d -> d.getFileKey() != null ? d.getFileKey() : d.getThumbKey())
                        .orElse(null);
                if (key != null) return key;
            }
        }
        return avatar.getImageKey(); // 回退定妆照
    }

    /** 引入校验：必须本人所有、不在回收站、已有定妆照。 */
    public DapAvatar requireUsable(String userId, String dapAvatarId) {
        DapAvatar avatar = avatarRepo.findByIdAndOwnerUserId(dapAvatarId, userId)
                .orElseThrow(() -> BusinessException.notFound("DAP_AVATAR_NOT_FOUND", "数字人不存在或无权访问"));
        if (avatar.getDeletedAt() != null) {
            throw BusinessException.badRequest("DAP_AVATAR_TRASHED", "该数字人已在回收站，请先在 AiAvatar 中恢复");
        }
        if (avatar.getImageKey() == null || avatar.getImageKey().isBlank()) {
            throw BusinessException.badRequest("DAP_AVATAR_NO_IMAGE", "该数字人还没有定妆照，请先在 AiAvatar 完成形象生成");
        }
        return avatar;
    }

    /** 展示图指针校验：格式合法且资产确属该数字人，否则 400。 */
    public void requireRefOfAvatar(String dapAvatarId, String ref) {
        if (ref.startsWith("look:")) {
            lookRepo.findById(ref.substring(5))
                    .filter(l -> dapAvatarId.equals(l.getAvatarId()) && l.getImageKey() != null)
                    .orElseThrow(() -> BusinessException.badRequest("DAP_DISPLAY_REF_INVALID", "指定的造型不存在或不属于该数字人"));
            return;
        }
        if (ref.startsWith("deriv:")) {
            derivRepo.findById(ref.substring(6))
                    .filter(d -> dapAvatarId.equals(d.getAvatarId())
                            && IMAGE_DERIV_KINDS.contains(d.getKind())
                            && (d.getFileKey() != null || d.getThumbKey() != null))
                    .orElseThrow(() -> BusinessException.badRequest("DAP_DISPLAY_REF_INVALID", "指定的场景图不存在、非图片类或不属于该数字人"));
            return;
        }
        throw BusinessException.badRequest("DAP_DISPLAY_REF_INVALID", "展示图指针格式应为 look:<id> 或 deriv:<id>");
    }
}
