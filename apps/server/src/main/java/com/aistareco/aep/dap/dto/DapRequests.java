package com.aistareco.aep.dap.dto;

import java.util.List;
import java.util.Map;

/** 数字人资产平台请求体集合（字段名与前端调用方一致）。 */
public final class DapRequests {

    private DapRequests() {}

    /** POST /api/v1/avatars */
    public record CreateAvatarRequest(String path, String entry, String name) {}

    /** PATCH /api/v1/avatars/{id} —— 全部可选；null = 不改。 */
    public record PatchAvatarRequest(String name, Boolean fav, String tagline, String archetype,
                                     Map<String, Object> def, String voiceName, String codename) {}

    /** POST /api/v1/avatars/{id}/describe —— AI 路径人设描述（可单独调，也随 generate 透传）。 */
    public record DescribeRequest(String desc, String style, String name, String age, String gender,
                                  String ethnic, String orient, String pose) {}

    /** POST /api/v1/avatars/{id}/generate */
    public record GenerateRequest(String mode, DescribeRequest form, String captureId) {}

    /** POST /api/v1/avatars/{id}/pick */
    public record PickRequest(Integer variantIndex) {}

    /** POST /api/v1/avatars/{id}/iterate */
    public record IterateRequest(String instruction) {}

    /** POST /api/v1/avatars/{id}/looks */
    public record CreateLookRequest(String source, String prompt, String sceneId) {}

    /**
     * POST /api/v1/avatars/{id}/derivatives
     * options（v0.52+，全部可选；缺省 = 各类型默认配方）：
     *   items: [{label, prompt}]  — expr/scene/ward 自定义条目（替换默认，≤6 条；中文 prompt 自动翻译）
     *   extraPrompt: string       — 追加到每张图/视频的补充约束（中文自动翻译）
     *   motion: orbit|push_in|pull_back|pan — 仅 video：运镜方式
     * templateId — 仅 atlas：美化模板。
     */
    public record CreateDerivativeRequest(String type, Map<String, Object> options, String templateId) {}

    /** POST /api/v1/avatars/{id}/finalize —— archive=true 时直接归档（AI 快速创建路径）。 */
    public record FinalizeRequest(String templateId, List<String> confirmedShots, Boolean archive) {}

    /** POST /api/v1/avatars/{id}/voice */
    public record BindVoiceRequest(String voiceId, String voiceName) {}

    /** POST /api/v1/captures */
    public record CreateCaptureRequest(String avatarId) {}

    /** POST /api/v1/licenses */
    public record CreateLicenseRequest(String subject, String avatarId, String scope,
                                       Integer years, List<String> platforms) {}

    /** POST /api/v1/voices/preview */
    public record VoicePreviewRequest(String voiceId, String text) {}
}
