package com.aistareco.aep.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * aep.picgen.* 配置 —— 文字转图 (纯 Java2D 内部渲染)。
 * v0.16+: 已从 Node + puppeteer 外部服务改为 in-process Java2D 实现，无网络依赖。
 */
@Configuration
@ConfigurationProperties(prefix = "aep.picgen")
public class PicgenProperties {

    private boolean enabled = true;
    /** 变体渲染时落盘目录（运行期 mixcut 引用）。 */
    private String outputDir = "./mixcut-output/picgen";
    /** 预览图落盘目录（前端 picgen-slot-input 引用）。 */
    private String previewDir = "./mixcut-output/picgen-preview";
    /** 预览图公开 URL 前缀，由 MixcutAsyncConfig 注册静态映射。 */
    private String previewPublicUrlBase = "/static/picgen-preview";

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getOutputDir() { return outputDir; }
    public void setOutputDir(String outputDir) { this.outputDir = outputDir; }

    public String getPreviewDir() { return previewDir; }
    public void setPreviewDir(String previewDir) { this.previewDir = previewDir; }

    public String getPreviewPublicUrlBase() { return previewPublicUrlBase; }
    public void setPreviewPublicUrlBase(String previewPublicUrlBase) { this.previewPublicUrlBase = previewPublicUrlBase; }
}
