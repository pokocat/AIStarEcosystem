import { describe, expect, it } from 'vitest';
import { accountPageKey, studioEntryDestination } from './account-navigation';

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
