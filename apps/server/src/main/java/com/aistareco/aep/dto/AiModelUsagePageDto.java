package com.aistareco.aep.dto;
import java.time.Instant;
import java.util.List;
/** Full matching total; the page limit only bounds a single response. */
public record AiModelUsagePageDto(List<AiModelUsageRecordDto> items, long total, int page, int size, Instant asOf) {}
