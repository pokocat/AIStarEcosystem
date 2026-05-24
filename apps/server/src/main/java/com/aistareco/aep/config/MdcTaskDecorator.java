package com.aistareco.aep.config;

import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;
import org.springframework.lang.NonNull;

import java.util.Map;

/**
 * 默认的 ThreadPoolTaskExecutor 投任务到 worker 线程时不 copy MDC —— 父线程里
 * {@code MDC.get("traceId")} 在 worker 里读到 null，所以渲染 worker / 异步业务的 log
 * 行会丢 trace 前缀，与同一次请求的入站 log 行无法 grep 串联。
 *
 * 本 decorator 在每个被提交的任务执行前，把当时父线程的 MDC 拷贝到 worker 线程，执行后
 * 还原 worker 线程之前的 MDC（避免污染线程池里下一个无关任务）。
 *
 * 用法：在 {@code ThreadPoolTaskExecutor.setTaskDecorator(new MdcTaskDecorator())}
 * 上挂一次即可。当前挂在 {@link MixcutAsyncConfig#mixcutExecutor()}。
 */
public class MdcTaskDecorator implements TaskDecorator {

    @NonNull
    @Override
    public Runnable decorate(@NonNull Runnable runnable) {
        // capture-time = 父线程提交任务的瞬间
        Map<String, String> captured = MDC.getCopyOfContextMap();
        return () -> {
            // run-time = worker 线程拿到任务开始跑的瞬间（可能是另一个之前跑过别的请求的线程）
            Map<String, String> previous = MDC.getCopyOfContextMap();
            if (captured != null) {
                MDC.setContextMap(captured);
            } else {
                MDC.clear();
            }
            try {
                runnable.run();
            } finally {
                if (previous != null) {
                    MDC.setContextMap(previous);
                } else {
                    MDC.clear();
                }
            }
        };
    }
}
