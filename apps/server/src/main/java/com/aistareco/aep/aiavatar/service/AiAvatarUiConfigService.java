package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.dto.AiAvatarUiConfigDto;
import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * AiAvatar UI 文案配置服务 —— 落 PlatformConfig key=aiavatar.ui-config（JSON）。
 * 读：缺省回退出厂默认；写：运营整体覆盖（与既有 engine-pricing / action-pricing 同惯例）。
 */
@Service
public class AiAvatarUiConfigService {

    public static final String CONFIG_KEY = "aiavatar.ui-config";

    private final PlatformConfigService platformConfig;
    private final ObjectMapper om;

    public AiAvatarUiConfigService(PlatformConfigService platformConfig, ObjectMapper om) {
        this.platformConfig = platformConfig;
        this.om = om;
    }

    /** 读取（缺省 / 解析失败 → 出厂默认；缺字段按默认补齐）。 */
    public AiAvatarUiConfigDto get() {
        Optional<PlatformConfigDto> cfg = platformConfig.findByKey(CONFIG_KEY);
        if (cfg.isEmpty() || cfg.get().value() == null || cfg.get().value().isNull()) {
            return AiAvatarUiConfigDto.defaults();
        }
        try {
            AiAvatarUiConfigDto parsed = om.treeToValue(cfg.get().value(), AiAvatarUiConfigDto.class);
            return merge(parsed);
        } catch (Exception e) {
            return AiAvatarUiConfigDto.defaults();
        }
    }

    /** 运营整体覆盖保存。 */
    public AiAvatarUiConfigDto update(AiAvatarUiConfigDto input, String updatedBy) {
        AiAvatarUiConfigDto merged = merge(input);
        JsonNode value = om.valueToTree(merged);
        platformConfig.upsert(CONFIG_KEY, value, "AiAvatar UI 文案配置（快捷指令 / 默认人设 / 局部重绘默认词）", updatedBy);
        return merged;
    }

    /** 缺字段按出厂默认补齐，避免运营漏填导致前端空数组。 */
    private AiAvatarUiConfigDto merge(AiAvatarUiConfigDto in) {
        AiAvatarUiConfigDto d = AiAvatarUiConfigDto.defaults();
        if (in == null) return d;
        return new AiAvatarUiConfigDto(
                in.draftPresets() != null && !in.draftPresets().isEmpty() ? in.draftPresets() : d.draftPresets(),
                in.refinePresets() != null && !in.refinePresets().isEmpty() ? in.refinePresets() : d.refinePresets(),
                in.personaChips() != null && !in.personaChips().isEmpty() ? in.personaChips() : d.personaChips(),
                in.defaultPersona() != null && !in.defaultPersona().isBlank() ? in.defaultPersona() : d.defaultPersona(),
                in.regionInpaintPrompt() != null && !in.regionInpaintPrompt().isBlank() ? in.regionInpaintPrompt() : d.regionInpaintPrompt()
        );
    }
}
