package com.aistareco.aep.service.materialvideo;

/**
 * 一个视频任务到了终态（成片或失败）。发布在结算事务里，监听方在提交之后再处理。
 * Studio 的制作计划靠它即时推进；没有它，计划要等下一次 60 秒巡检才知道子任务结束了（2026-10-29 本地真跑：厂商拒绝后助手约 90 秒仍显示「生成中」）。
 */
public record MaterialVideoJobEnded(String jobId, String ownerUserId, String app, String status) {}
