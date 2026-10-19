package com.aistareco.aep.dto;

/** Live aggregate only; never exposes another user's task or input. Position is 1-based among waiting tickets. */
public record AiGenerationQueuePositionDto(long position, long waiting, long running, Integer concurrencyLimit) {}
