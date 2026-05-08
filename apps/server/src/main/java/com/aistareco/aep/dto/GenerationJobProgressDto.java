package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * 视频生成异步任务进度（v0.5.1 新增）。
 *
 * 替代客户端 setInterval 模拟，由 server 维护任务表 + 计算进度。
 * 字段对齐小程序 generating 页的 4 步 Pipeline 期望。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GenerationJobProgressDto(
        String jobId,
        int progress,        // 0..100
        int currentStep,     // 0..3 索引
        int etaSec,          // 剩余秒数（粗估）
        String state,        // queued / running / done / failed
        List<StepDto> steps
) {
    public record StepDto(
            String name,     // 脚本撰写 / 分镜画面生成 / AI 配音合成 / 视频合成与渲染
            String sub,      // 副标
            String state,    // done / current / todo
            String time      // 耗时 / 进行中 / —
    ) {}
}
