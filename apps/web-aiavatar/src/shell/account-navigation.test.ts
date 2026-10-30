import { describe, expect, it } from 'vitest';
import { accountPageKey, studioEntryDestination, studioReturnPath, studioWithReturn } from './account-navigation';

// v0.230 入口迁移：每一行都是一条要保留的深链。
describe('unified account navigation', () => {
  it('replaces bare root entries with their new destinations', () => {
    for (const [hash, destination] of [['','/projects'], ['#studio','/projects'], ['#/studio','/projects'], ['#/home','/dashboard'], ['#/library','/assets'], ['#/me','/me'], ['#/licenses','/licenses']]) {
      expect(studioEntryDestination(hash), hash).toBe(destination);
    }
  });
  it('preserves stateful or account links and creation entries', () => {
    for (const hash of ['#/tasks','#/settings','#/membership','#/avatar/DH-1/voice','#/create/real','#/real-auth/session-1']) {
      expect(studioEntryDestination(hash), hash).toBeUndefined();
    }
    for (const search of ['?start=real','?start=ai','?start=sheet','?start=compose','?create=1']) {
      expect(studioEntryDestination('', search), search).toBeUndefined();
    }
  });
  it('matches security to settings and leaves asset flows outside account selection', () => {
    expect(accountPageKey('#/security')).toBe('settings');
    expect(accountPageKey('#/membership')).toBe('membership');
    expect(accountPageKey('#/avatar/DH-1/voice')).toBeUndefined();
  });
});

describe('returning from the legacy studio', () => {
  it('adds the source page to studio links only', () => {
    expect(studioWithReturn('/studio#/voice', '/assets?tab=voices&category=preset')).toBe('/studio?from=%2Fassets%3Ftab%3Dvoices%26category%3Dpreset#/voice');
    expect(studioWithReturn('/assets/DH-1', '/assets')).toBe('/assets/DH-1');
  });
  it('only trusts paths on this site', () => {
    expect(studioReturnPath('/assets?tab=voices')).toBe('/assets?tab=voices');
    for (const bad of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example']) expect(studioReturnPath(bad), String(bad)).toBeUndefined();
  });
});

// 2026-10-30 线上复核：设置页四个开关只改页面状态、刷新就复原，接通前不显示。
describe('settings screen', () => {
  it('shows no switches that save nothing', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../proto/screen-more.tsx', import.meta.url), 'utf8');
    for (const label of ['推送通知', '任务完成提醒', '生成默认加水印', '定稿后自动归档']) expect(source).not.toContain(`label: '${label}'`);
  });
});
