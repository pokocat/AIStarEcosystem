// 在已用超管登录的页面里发布（serve.mjs 的用法说明）。令牌只在这个页面里用，只发给当前站点。

import { publishAll } from './publish-core.mjs';

const server = new URL('.', import.meta.url).href;
const TOKEN_KEY = 'aistareco.auth.token'; // packages/api-client/src/token-store.ts

export async function start(options = {}) {
  const probes = await fetch(`${server}probe.json`).then((r) => r.json());
  const ref = (skill, file) => `${encodeURIComponent(skill)}/${encodeURIComponent(file)}`;
  const state = { running: true, failed: undefined, lines: [] };
  publishAll({
    base: location.origin,
    token: () => localStorage.getItem(TOKEN_KEY),
    has: (skill, file) => !!probes[`${skill}/${file}`],
    sample: async (skill, file) => ({
      blob: await fetch(`${server}sample/${ref(skill, file)}`).then((r) => { if (!r.ok) throw new Error(`读取素材 ${skill}/${file} → ${r.status}`); return r.blob(); }),
      name: file, ...probes[`${skill}/${file}`],
    }),
    poster: (skill, file) => fetch(`${server}poster/${ref(skill, file)}`).then((r) => { if (!r.ok) throw new Error(`读取静帧 ${skill}/${file} → ${r.status}`); return r.blob(); }),
    log: (line) => state.lines.push(line),
  }, options).then((failed) => { state.failed = failed; }, (error) => { state.failed = -1; state.lines.push(`中止：${error.message}`); }).finally(() => { state.running = false; });
  return state;
}
