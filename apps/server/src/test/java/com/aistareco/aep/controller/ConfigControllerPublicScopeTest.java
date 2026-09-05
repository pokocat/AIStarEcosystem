package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.identity.IdentityOutboxPoller;
import com.aistareco.aep.service.PlatformConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.IntNode;
import com.fasterxml.jackson.databind.node.TextNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code /api/config} 是 permitAll 的匿名公开读接口，
 * 而 {@code aep_platform_configs} 是全站共用的键值表（游标 / 死信 / 种子版本号 / 配额都在里面）。
 *
 * <p>这道门守住「公开读只吐白名单前缀」——尤其是 {@code identity.*}
 * （{@code identity.outbox.deadletter} 里记着账号中心事件的失败原因，
 * 从前还带着 uid 原文，见 {@link IdentityOutboxPoller#safeReason}）。
 */
class ConfigControllerPublicScopeTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private PlatformConfigService service;
    private MockMvc mvc;

    private static PlatformConfigDto row(String key, com.fasterxml.jackson.databind.JsonNode value) {
        return new PlatformConfigDto(key, value, 1, "desc", Instant.parse("2026-01-01T00:00:00Z"), "system");
    }

    @BeforeEach
    void setUp() {
        service = mock(PlatformConfigService.class);
        mvc = MockMvcBuilders.standaloneSetup(new ConfigController(service)).build();
    }

    @Test
    void listOnlyReturnsPublicPrefixes() throws Exception {
        when(service.listAll()).thenReturn(List.of(
                row("incubation.cost", IntNode.valueOf(100)),
                row("forge.hairStyles", OM.createArrayNode()),
                row("drama.credit.frame", IntNode.valueOf(2)),
                // 以下都是内部状态，绝不能出现在匿名响应里
                row(IdentityOutboxPoller.CURSOR_KEY, TextNode.valueOf("42")),
                row(IdentityOutboxPoller.DEADLETTER_KEY, OM.createArrayNode()),
                row("aep.material.seed-version", TextNode.valueOf("v7")),
                row("storage.quota_mb.default", IntNode.valueOf(2048)),
                row("celebrity.engine-pricing", OM.createObjectNode())));

        String body = mvc.perform(get("/api/config"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).contains("incubation.cost", "forge.hairStyles", "drama.credit.frame");
        assertThat(body).as("内部 key 不得出现在匿名 /api/config 响应里")
                .doesNotContain("identity.")
                .doesNotContain("aep.material.seed-version")
                .doesNotContain("storage.quota_mb")
                .doesNotContain("celebrity.engine-pricing");
    }

    @Test
    void deadLetterKeyIsNotFoundForAnonymousReaders() throws Exception {
        mvc.perform(get("/api/config/" + IdentityOutboxPoller.DEADLETTER_KEY))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/config/" + IdentityOutboxPoller.CURSOR_KEY))
                .andExpect(status().isNotFound());

        // 关键：连查都不查 —— 不给匿名探测「这个内部 key 存在吗」的信号
        verify(service, never()).requireByKey(anyString());
    }

    @Test
    void publicKeyStillReadableByKey() throws Exception {
        when(service.requireByKey("incubation.cost")).thenReturn(row("incubation.cost", IntNode.valueOf(100)));

        mvc.perform(get("/api/config/incubation.cost")).andExpect(status().isOk());
    }

    /** 前缀匹配必须带 {@code .}：同前缀异语义 key 不得蹭进来。 */
    @Test
    void prefixMatchIsWholeSegment() {
        assertThat(ConfigController.isPublicKey("incubation.cost")).isTrue();
        assertThat(ConfigController.isPublicKey("incubation-secret.token")).isFalse();
        assertThat(ConfigController.isPublicKey("incubation.")).as("前缀本身不是一个 key").isFalse();
        assertThat(ConfigController.isPublicKey("drama.hotspot.source-url")).isFalse();
        assertThat(ConfigController.isPublicKey("identity.outbox.deadletter")).isFalse();
        assertThat(ConfigController.isPublicKey(null)).isFalse();
    }
}
