package com.aistareco.aep.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 音乐生成运行参数。全部可由 env 覆盖，默认值贴合火山「AI 音乐生成大模型」的实际约束。
 */
@Data
@Component
@ConfigurationProperties(prefix = "aep.music.gen")
public class MusicGenProperties {

    /**
     * 并发上限。火山公共资源池 QPS ≤ 2，且并发也受限，
     * 设太大只会在上游排队并放大超时风险。
     */
    private int maxConcurrent = 2;

    /** 轮询间隔（秒）。 */
    private int pollIntervalSeconds = 5;

    /**
     * 单任务最长等待（秒）。必须远小于 CreditHoldSweeper 的 180 分钟兜底 TTL，
     * 否则孤儿 hold 会先被清扫、再被 worker 二次结算。
     */
    private int maxWaitSeconds = 600;

    /** 产物下载大小上限（字节），默认 64MiB —— 4 分钟 wav 约 40MiB。 */
    private long maxDownloadBytes = 64L * 1024 * 1024;

    /** 音频镜像到 CDN/OSS。关闭时任务直接判失败（§8.0：不交付会过期的上游地址）。 */
    private boolean uploadToCdn = true;

    /** reaper 判定僵死的心跳超时（秒）。 */
    private int staleHeartbeatSeconds = 900;

    /** 人声歌曲时长下限 / 上限（秒）。 */
    private int minDurationSec = 30;
    private int maxDurationSec = 240;

    /** 纯音乐 BGM 时长上限（秒）。 */
    private int maxInstrumentalDurationSec = 60;

    /** 未配端点单价时的默认积分单价（每秒）。 */
    private long defaultCreditsPerSecond = 1L;

    /** 火山 OpenAPI 签名参数。 */
    private String volcRegion = "cn-beijing";
    private String volcService = "imagination";
    private String volcVersion = "2024-08-12";
    /** 后付费按时长计费（GenSongForTime）；预付费资源包用 GenSongV4。 */
    private String volcSongAction = "GenSongForTime";
    private String volcQueryAction = "QuerySong";
    /** 音频输出格式：wav | mp3。 */
    private String volcAudioFormat = "mp3";
    /** 显式 AIGC 水印。 */
    private boolean volcAigcWatermark = true;
}
