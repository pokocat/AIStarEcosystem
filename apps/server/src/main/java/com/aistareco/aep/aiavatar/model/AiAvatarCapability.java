package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * AI 能力分类（任务书 §4 / §5）。每个能力对应一个 {@code CapabilityProvider} 实现族
 * （Mock / Backend / SelfHost）。Job 的 capability 字段即取自此枚举。
 *
 * wire 串与任务书 §5 capability() 完全一致（camelCase），便于前后端 / 文档对照。
 */
public enum AiAvatarCapability {
    FACE_CLONE("faceClone", "真人复刻打样", "扩散模型(ID 保持) · InstantID/IP-Adapter-FaceID"),
    TXT2IMG("txt2img", "AI 原创打样", "文生图 · SDXL/FLUX"),
    IMG2IMG("img2img", "草稿指令调整", "图生图/指令编辑 · InstructPix2Pix"),
    FACE_WARP("faceWarp", "几何微调", "MediaPipe FaceMesh + TPS/liquify（确定性，真实算法）"),
    INPAINT("inpaint", "局部重绘", "SD Inpainting + ControlNet + 分割 mask"),
    MAKEUP("makeup", "妆容迁移", "EleGANt/BeautyGAN/SCGAN"),
    HAIR("hair", "发型变换", "HairCLIP/Barbershop/StableHair"),
    RESTORE("restore", "美颜/质感", "GFPGAN/CodeFormer + 美白磨皮"),
    IMG23D("img23d", "2D→3D", "TripoSR（简易） / FLAME+3DGS（高精）"),
    IMG2VIDEO("img2video", "场景渲染短视频", "SVD-XT / AnimateDiff（仅运镜）"),
    FACE_DETECT("faceDetect", "人脸合规检测", "InsightFace(RetinaFace) · 遮挡/模糊/多脸"),
    NLU("nlu", "人设文案解析", "后端 LLM 网关 · 描述词→结构化人设"),
    SEGMENT("segment", "局部区域分割", "SAM / face-parsing(BiSeNet) · 生成 inpaint mask");

    private final String wire;
    private final String label;
    private final String approach;

    AiAvatarCapability(String wire, String label, String approach) {
        this.wire = wire;
        this.label = label;
        this.approach = approach;
    }

    @JsonValue
    public String wire() {
        return wire;
    }

    public String label() {
        return label;
    }

    /** 该能力的首选真实技术方案（前端「实现方式」面板展示）。 */
    public String approach() {
        return approach;
    }

    @JsonCreator
    public static AiAvatarCapability fromWire(String w) {
        if (w == null) return TXT2IMG;
        for (AiAvatarCapability c : values()) {
            if (c.wire.equalsIgnoreCase(w) || c.name().equalsIgnoreCase(w)) return c;
        }
        return TXT2IMG;
    }
}
