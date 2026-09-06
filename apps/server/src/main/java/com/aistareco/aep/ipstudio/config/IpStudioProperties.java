package com.aistareco.aep.ipstudio.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** AI IP 工作台运行参数（{@code aep.ipstudio.*}）。 */
@Component
@ConfigurationProperties(prefix = "aep.ipstudio")
public class IpStudioProperties {

    /**
     * 一次出图最多带几张参考图。
     *
     * <p>固定配置而非读 {@code AiAppEndpointCandidate.maxRefImages}：{@code DapMultimodalClient}
     * 目前完全不读 candidate 能力（见 ip-studio-plan §8 后置项）。超出上限的参考图不静默丢弃，
     * 而是按 master → source → reference 的顺序砍尾并如实回报 {@code reason=over_max_refs}。
     */
    private int maxRefImages = 4;

    /** 并发出图线程数（一次运行内的多张候选是串行的，这里限制的是同时运行的节点数）。 */
    private int maxConcurrent = 3;

    /** running 且心跳超过该分钟数 → reaper 判失败并释放冻结。 */
    private int staleMinutes = 15;

    /** 上传单文件字节上限（照片 / 参考图）。 */
    private long uploadMaxBytes = 15L * 1024 * 1024;

    /** 画布文档字节上限：整存整取的 doc 不设闸就等于把 TEXT 列开放给客户端。 */
    private long docMaxBytes = 2L * 1024 * 1024;

    /**
     * 上传图片最长边像素上限。
     *
     * <p>只靠字节数挡不住 decompression bomb —— 一张 200KB 的 PNG 可以声明 50000×50000，
     * 整图解码瞬间要几十 GB 堆。上传时只读文件头判尺寸，超限直接拒，不进解码。
     */
    private int uploadMaxDimension = 8000;

    public int getMaxRefImages() { return maxRefImages; }
    public void setMaxRefImages(int v) { this.maxRefImages = v; }
    public int getMaxConcurrent() { return maxConcurrent; }
    public void setMaxConcurrent(int v) { this.maxConcurrent = v; }
    public int getStaleMinutes() { return staleMinutes; }
    public void setStaleMinutes(int v) { this.staleMinutes = v; }
    public long getUploadMaxBytes() { return uploadMaxBytes; }
    public void setUploadMaxBytes(long v) { this.uploadMaxBytes = v; }
    public long getDocMaxBytes() { return docMaxBytes; }
    public void setDocMaxBytes(long v) { this.docMaxBytes = v; }
    public int getUploadMaxDimension() { return uploadMaxDimension; }
    public void setUploadMaxDimension(int v) { this.uploadMaxDimension = v; }
}
