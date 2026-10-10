import { describe, expect, it } from 'vitest';
import { accountPageKey, studioEntryDestination } from './account-navigation';

describe('unified account navigation', () => {
  it.each([['','/projects'], ['#studio','/projects'], ['#/studio','/projects'], ['#/home','/dashboard'], ['#/library','/assets'], ['#/me','/me'], ['#/licenses','/licenses']])('replaces root %s with %s', (hash, destination) => {
    expect(studioEntryDestination(hash)).toBe(destination);
  });
  it.each(['#/tasks','#/settings','#/membership','#/avatar/DH-1/voice','#/create/real','#/real-auth/session-1'])('preserves stateful or account link %s', hash => {
    expect(studioEntryDestination(hash)).toBeUndefined();
  });
  it.each(['?start=real','?start=ai','?start=sheet','?start=compose','?create=1'])('does not redirect creation entry %s', search => {
    expect(studioEntryDestination('', search)).toBeUndefined();
  });
  it('matches security to settings and leaves asset flows outside account selection', () => {
    expect(accountPageKey('#/security')).toBe('settings');
    expect(accountPageKey('#/membership')).toBe('membership');
    expect(accountPageKey('#/avatar/DH-1/voice')).toBeUndefined();
  });
});
