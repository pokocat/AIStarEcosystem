package com.aistareco.aep.dap.dto;

import java.util.List;
import java.util.Map;

/**
 * 数字人广场 · 运营新增 / 编辑公开数字人入参（POST/PUT /api/v1/admin/avatars）。
 * 图片先经 /api/v1/admin/uploads 上传拿到 storage key，再把 key 放进 frontKey/rightKey/leftKey。
 */
public record DapPublicAvatarUpsertRequest(
        String name,
        String codename,
        String archetype,
        String tagline,
        String cat,
        Integer hue,
        String engine,
        String voiceName,
        Map<String, Object> palette,
        // 设定档案分字段（也接受整包 def）；性格为多值
        String age,
        String temperament,
        String usage,
        List<String> traits,
        String outfit,
        String persona,
        Map<String, Object> def,
        String frontKey,
        String rightKey,
        String leftKey,
        Boolean fav,
        Integer sortOrder) {
}
