package com.aistareco.aep.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 子产品平台访问隔离的核心逻辑测试（v0.43+）。
 * 重点：canAccess 对「未授予的平台」返回 false（隔离成立），对空配置宽松放行（老账号不被锁）。
 */
class PlatformSupportTest {

    @Test
    void parse_cleansAndKeepsKnownOnly() {
        assertEquals(List.of("music", "drama", "celebrity"), PlatformSupport.parse("music,drama,celebrity"));
        // 去空格 / 大小写归一 / 去重 / 丢弃未知平台 / 保序
        assertEquals(List.of("music", "drama"), PlatformSupport.parse(" Music , music ,X, DRAMA "));
        assertTrue(PlatformSupport.parse(null).isEmpty());
        assertTrue(PlatformSupport.parse("   ").isEmpty());
        assertTrue(PlatformSupport.parse("unknown,foo").isEmpty());
    }

    @Test
    void effective_emptyFallsBackToAll() {
        assertEquals(PlatformSupport.ALL, PlatformSupport.effective(null));
        assertEquals(PlatformSupport.ALL, PlatformSupport.effective(""));
        assertEquals(List.of("music"), PlatformSupport.effective("music"));
    }

    @Test
    void canAccess_enforcesIsolationWhenConfigured() {
        // 仅授予 music：music 放行，drama / celebrity 拒绝（隔离成立）
        assertTrue(PlatformSupport.canAccess("music", "music"));
        assertFalse(PlatformSupport.canAccess("music", "drama"));
        assertFalse(PlatformSupport.canAccess("music", "celebrity"));

        // 授予 music+drama
        assertTrue(PlatformSupport.canAccess("music,drama", "drama"));
        assertFalse(PlatformSupport.canAccess("music,drama", "celebrity"));
    }

    @Test
    void canAccess_emptyConfigGrantsAll() {
        // 空配置（老账号 / 未回填）→ 全部放行，避免误锁
        assertTrue(PlatformSupport.canAccess(null, "music"));
        assertTrue(PlatformSupport.canAccess("", "drama"));
        assertTrue(PlatformSupport.canAccess("", "celebrity"));
    }

    @Test
    void toCsv_roundTrips() {
        assertEquals("music,drama,celebrity", PlatformSupport.toCsv(PlatformSupport.ALL));
        assertEquals("music", PlatformSupport.toCsv(List.of("music")));
        // 清洗未知项
        assertEquals("drama", PlatformSupport.toCsv(List.of("drama", "bogus")));
    }
}
