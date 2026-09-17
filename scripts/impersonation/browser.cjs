// Production Next pages, synthetic browser API fixtures; no production account or data is touched.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const product = process.argv[2];
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3800';
const key = 'aistareco.impersonation';
const code = 'a'.repeat(43), token = 'imp_' + 'b'.repeat(43);
const callback = '/auth/callback/impersonation';
const result = [];
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    if (product === 'admin-new') {
      const ctx = await browser.newContext();
      // Admin token key is independent of the consumer token store.
      await ctx.addInitScript(() => localStorage.setItem('aistareco.admin.auth.token', 'synthetic-admin-token'));
      const page = await ctx.newPage();
      page.on('pageerror', error => console.error('ADMIN_PAGE_ERROR', error.message));
      let startBody;
      await ctx.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let data = [];
        if (path === '/api/admin/auth/me') data = { id: 'admin-fixture', username: 'admin-fixture', displayName: '测试管理员', role: 'super_admin', status: 'active', accountSource: 'admin' };
        else if (path === '/api/admin/users') data = [{ id: 'target-fixture', username: 'target-fixture', displayName: '附身测试用户', status: 'active', kind: 'personal', createdAt: '2026-09-17T00:00:00Z' }];
        else if (path.endsWith('/impersonate')) {
          assert.equal(path, '/api/admin/aep-users/target-fixture/impersonate');
          assert.equal(route.request().headers().authorization, 'Bearer synthetic-admin-token');
          startBody = route.request().postDataJSON();
          data = { handoffUrl: `${base}${callback}#code=${code}` };
        }
        await route.fulfill({ json: { success: true, data } });
      });
      await page.goto(base + '/admin/platform/accounts');
      await page.getByRole('button', { name: '附身登录', exact: true }).click();
      await page.getByRole('combobox', { name: '选择产品' }).selectOption('drama');
      fs.mkdirSync('test-results', { recursive: true });
      await page.screenshot({ path: 'test-results/admin-impersonation.png', fullPage: true });
      const popupPromise = page.waitForEvent('popup');
      await page.getByRole('button', { name: '登录用户账号', exact: true }).click();
      const popup = await popupPromise;
      await popup.waitForURL('**/auth/callback/impersonation#code=*');
      assert.deepEqual(startBody, { product: 'drama' });
      result.push('admin list → dialog → authenticated request → separate tab');
      await ctx.close();
    } else {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(() => {
        localStorage.setItem('aistareco.auth.token', 'original-user-token');
        localStorage.setItem('aistareco.auth.refresh', 'original-user-refresh');
      });
      let exchanges = 0, exits = 0, meRequests = 0;
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await ctx.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/auth/impersonation/exchange') {
          exchanges++;
          assert.deepEqual(route.request().postDataJSON(), { code, product });
          assert.equal(route.request().headers().authorization, undefined);
          return route.fulfill({ json: { success: true, data: { token, targetName: '附身测试用户', product, expiresAt: '2099-01-01T00:00:00Z' } } });
        }
        if (path === '/api/auth/impersonation/exit') {
          exits++;
          assert.equal(route.request().headers().authorization, 'Bearer ' + token);
          return route.fulfill({ json: { success: true, data: { closed: true } } });
        }
        if (path === '/api/me') meRequests++;
        return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
      });
      // Capture the completed handoff navigation without loading unrelated business screens.
      await page.route(base + '/dashboard', route => route.fulfill({ contentType: 'text/html', body: '<main>handoff completed</main>' }));
      await page.goto(base + callback + '#code=' + code);
      await page.waitForURL(base + '/dashboard');
      assert.equal(exchanges, 1);
      assert.equal(meRequests, 0, 'callback must not load the original account');
      assert.equal(await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)).token, key), token);
      assert.equal(await page.evaluate(() => localStorage.getItem('aistareco.auth.token')), 'original-user-token');
      result.push('one exchange, no original-user request, isolated tab storage');
      const other = await ctx.newPage();
      await other.route(base + '/tab-check', route => route.fulfill({ contentType: 'text/html', body: '<main>other tab</main>' }));
      await other.goto(base + '/tab-check');
      assert.equal(await other.evaluate(k => sessionStorage.getItem(k), key), null);
      await other.close();
      await page.goto(base + callback + '?expired=1');
      await page.getByText('附身链接已失效', { exact: false }).waitFor();
      await page.getByRole('button', { name: '退出附身', exact: true }).waitFor();
      await page.waitForTimeout(700);
      assert.equal(meRequests, 0, 'expired callback must not trigger a 401 navigation loop');
      assert.equal(exchanges, 1);
      assert.equal(errors.length, 0, errors.join('\n'));
      fs.mkdirSync('test-results', { recursive: true });
      await page.screenshot({ path: `test-results/${product}-impersonation.png`, fullPage: true });
      await page.route(base + '/', route => route.fulfill({ contentType: 'text/html', body: '<main>exited</main>' }));
      await page.getByRole('button', { name: '退出附身', exact: true }).click();
      await page.waitForURL(base + '/');
      assert.equal(exits, 1);
      assert.equal(await page.evaluate(k => sessionStorage.getItem(k), key), null);
      assert.equal(await page.evaluate(() => localStorage.getItem('aistareco.auth.token')), 'original-user-token');
      result.push('expired page is stable; explicit exit restores original account without changing its tokens');
      await ctx.close();
    }
    console.log(JSON.stringify({ product, result, fixtureScope: 'synthetic API responses; real production Next pages and browser' }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
