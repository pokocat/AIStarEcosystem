// 灵感库示例的发布逻辑（docs/studio-inspiration-library.md）。这里不碰文件系统，素材、尺寸和静帧由
// publish.mjs 提供，测试也能直接引用 buildDoc。
//
// 走的都是现有接口：上传素材 → 建画布 → 存为官方内容 → 设封面和排序 → 删掉中转画布。
// 编号固定，重复执行是更新同一条，不会多出新条目。不调用任何模型，不扣积分。
//
// 画布就是这条示例的生成链，和官方模板一样原样展示：参考图连到生成节点，生成节点里放着提示词和生成结果。
// 不再另放一张等着生成的空卡和一张不连任何东西的示例效果（2026-11-09 用户要求：看不出工作流怎么走）。
//
// 已发布的条目默认只更新名称、说明、排序和上下线。另外两种：
// · rebuild：按线上这条示例已有的素材重排画布，不重新上传。要求服务端已经是「示例目录里的素材原样留用」那一版
//   （IpDemoTemplateService.copyKey），旧版服务端会复制一份再删掉旧文件，用户做同款的画布就打不开了。
//   所以每发一条都核对素材是否原样，有变化就停下。
// · force：用本机素材重新上传、重建画布。服务端会删掉旧版素材副本，而用户做同款得到的画布引用的正是那些文件，
//   他们画布里的结果会打不开（提示词不受影响）。只在换素材时用。

import { INSPIRATIONS, ratioOf } from './catalog.mjs';

const SKILL_OF_KIND = { image: 'image-generation', video: 'video-generation' };
const RESULT_TITLE = { image: '成图', video: '成片' };

/** 媒体卡片的尺寸：宽度随比例走，竖版窄一点，高度按比例算（头部约 44）。 */
function cardSize(ratio) {
  const width = ratio >= 1 ? 460 : 320;
  return { width, height: Math.round(width / ratio) + 44 };
}

const instructions = (item) => {
  const result = RESULT_TITLE[item.kind];
  const input = item.input && (item.input.sample
    ? `「${item.input.title}」是生成这条示例用的参考图，可以换成你自己的${item.input.hint}。`
    : `把${item.input.hint}放进「${item.input.title}」就会用作参考，不放也能生成。`);
  // 按画布上的顺序写：先参考图，再生成节点。
  const steps = [
    ...(input ? [input] : []),
    `「${result}」里是这条示例的提示词和生成结果。${item.replace}，再在这张卡上点生成，新结果会作为新版本加入，原来的示例版本会保留。`,
    '也可以直接发送助手输入框里填好的内容。生成前会显示所需积分。',
  ];
  return [
    item.summary, '',
    '这套做法',
    ...item.method.map((line) => `· ${line}`), '',
    '怎么用',
    ...steps.map((line, index) => `${index + 1}. ${line}`),
  ].join('\n');
};

/**
 * 示例画布：创作说明，参考图（有的话）→ 生成节点（提示词 + 生成结果）。
 * uploaded 是这条示例的生成结果，第一个是当前显示的版本，其余作为同一张卡里的其他版本；inputAsset 是参考图。
 */
export function buildDoc(item, uploaded, inputAsset) {
  if (!uploaded.length) throw new Error(`${item.id} 没有生成结果`);
  const nodes = [], connections = [];
  const [primary] = uploaded, video = item.kind === 'video';
  const column = 380, gap = 80, guideHeight = 440, result = cardSize(primary.width / primary.height);
  const verb = video ? '帮我生成这段视频：' : '帮我生成这张图：';
  nodes.push({ id: 'guide', type: 'text', title: '创作说明', position: { x: 0, y: 0 }, width: column, height: guideHeight,
    metadata: { content: instructions(item), prompt: item.request || `${verb}${item.prompt}`, studioStart: 'assistant', studioSkill: item.assistantSkill || SKILL_OF_KIND[item.kind], status: 'idle' } });
  if (item.input) {
    const width = column, height = inputAsset ? Math.round(width * inputAsset.height / inputAsset.width) + 44 : 280;
    nodes.push({ id: 'input', type: 'image', title: item.input.title, position: { x: 0, y: guideHeight + 40 }, width, height,
      metadata: inputAsset
        ? { storageKey: inputAsset.key, status: 'success', origin: 'example', mimeType: inputAsset.mimeType, naturalWidth: inputAsset.width, naturalHeight: inputAsset.height, size: `${inputAsset.width}x${inputAsset.height}` }
        // 选填：空着不挡生成，放了图才当参考（studio-linked-inputs.ts）。
        : { status: 'idle', studio: { templateInput: { required: false, label: item.input.title } } } });
    connections.push({ id: 'c-input', fromNodeId: 'input', toNodeId: 'result' });
  }
  // 版本列表和平常生成出来的一样（studio-nodes.ts retainStudioMediaVersions）：用户在这张卡上重新生成，示例这几版留着。
  const takes = uploaded.map((sample, index) => ({
    id: `take-${index + 1}`, status: 'success', storageKey: sample.key, prompt: item.prompt, mimeType: sample.mimeType,
    ...(video ? { seconds: String(Math.round(sample.seconds) || item.seconds) } : { content: '', naturalWidth: sample.width, naturalHeight: sample.height, bytes: sample.bytes || 0 }),
  }));
  nodes.push({ id: 'result', type: item.kind, title: RESULT_TITLE[item.kind], position: { x: column + gap, y: 0 }, width: result.width, height: result.height,
    metadata: {
      prompt: item.prompt, size: item.ratio, ...(video ? { seconds: item.seconds } : { count: 1 }),
      storageKey: primary.key, status: 'success', origin: 'example', mimeType: primary.mimeType, bytes: primary.bytes, naturalWidth: primary.width, naturalHeight: primary.height,
      ...(video ? { durationMs: Math.round(primary.seconds * 1000), videos: takes, primaryVideoId: 'take-1' } : { images: takes, primaryImageId: 'take-1' }),
    } });
  // 助手默认停靠在一侧，打开时让开左栏，尽量一眼看全：1440 宽的窗口去掉助手和左栏后约 900。
  const total = column + gap + result.width, k = Math.min(0.72, Math.round(840 / total * 100) / 100);
  return { nodes, connections, viewport: { x: 76, y: 76, k } };
}

/**
 * 从线上已发布的画布里取回这条示例的素材：生成结果（按显示顺序）和参考图。
 * 认两种画布：重排前的（「示例效果」sample-N 节点）和重排后的（result 节点的版本列表），重复执行也能用。
 */
export function publishedAssets(doc) {
  const nodes = doc?.nodes ?? [];
  const asset = (meta, key = meta?.storageKey) => key && {
    key, mimeType: meta.mimeType, bytes: meta.bytes, width: meta.naturalWidth, height: meta.naturalHeight, seconds: (meta.durationMs || 0) / 1000,
  };
  const input = nodes.find((n) => n.id === 'input')?.metadata;
  const result = nodes.find((n) => n.id === 'result')?.metadata;
  let uploaded;
  if (result) {
    const takes = result.videos ?? result.images ?? [];
    const primary = result.primaryVideoId ?? result.primaryImageId;
    const ordered = [...takes].sort((a, b) => Number(b.id === primary) - Number(a.id === primary));
    uploaded = ordered.map((take) => take.storageKey === result.storageKey
      ? asset(result)
      : { ...asset(result, take.storageKey), bytes: take.bytes, width: take.naturalWidth || result.naturalWidth, height: take.naturalHeight || result.naturalHeight, seconds: Number(take.seconds) || result.durationMs / 1000 });
  } else {
    uploaded = nodes.filter((n) => /^sample-\d+$/.test(n.id)).sort((a, b) => Number(a.id.slice(7)) - Number(b.id.slice(7))).map((n) => asset(n.metadata));
  }
  return { uploaded: uploaded.filter(Boolean), inputAsset: asset(input) || undefined };
}

/** 画布里引用的全部素材 key，用来核对重排前后是不是同一批文件。 */
const keysOf = (doc) => new Set(JSON.stringify(doc ?? {}).match(/"storageKey":"[^"]+"/g)?.map((m) => m.slice(14, -1)) ?? []);

/**
 * @param host.base    后端地址；浏览器里传当前站点
 * @param host.token   () => 超级管理员令牌，每次请求现取（页面可能中途刷新令牌）
 * @param host.has     (skill, file) => 素材是否存在
 * @param host.sample  (skill, file) => { blob, name, width, height, seconds }
 * @param host.poster  (skill, file, seconds) => 静帧 Blob：卡片和弹窗用，取中段
 * @param host.log     (line) => void
 * @returns 失败条数
 */
export async function publishAll(host, { only, force = false, rebuild = false, dry = false } = {}) {
  const { log } = host;
  async function api(path, init = {}) {
    const res = await fetch(`${host.base}/api/v1/ip-studio${path}`, {
      ...init, headers: { Authorization: `Bearer ${host.token()}`, ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
    });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = undefined; }
    if (!res.ok || body?.success === false) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${body?.error?.code || ''} ${body?.error?.message || text.slice(0, 200)}`);
    return body?.data;
  }
  const json = (method, payload) => ({ method, body: JSON.stringify(payload ?? {}) });
  const form = (blob, name, fields = {}) => {
    const body = new FormData();
    body.append('file', blob, name);
    for (const [key, value] of Object.entries(fields)) if (value) body.append(key, value);
    return { method: 'POST', body };
  };

  async function folderId() {
    const name = '灵感库示例素材';
    const folders = await api('/library/folders');
    return (folders.find((f) => f.name === name) || await api('/library/folders', json('POST', { name }))).id;
  }

  async function upload(skill, file, kind, folder) {
    const sample = await host.sample(skill, file);
    const done = await api('/library/uploads', form(sample.blob, sample.name, { mediaType: kind, folderId: folder }));
    return { key: done.key, mimeType: done.mimeType, bytes: done.bytes, width: sample.width, height: sample.height, seconds: sample.seconds };
  }

  /** 中转画布 → 存为官方内容（同一个编号就是更新那一条）→ 删掉中转画布。 */
  async function publishDoc(demoId, item, doc) {
    const project = await api('/projects', json('POST', { name: item.name }));
    try {
      await api(`/projects/${project.id}`, json('PUT', { doc, baseDocVersion: project.docVersion }));
      await api(`/projects/${project.id}/publish-as-demo`, json('POST', { demoId, name: item.name, summary: item.summary, kind: 'example' }));
    } finally {
      await api(`/projects/${project.id}`, { method: 'DELETE' }).catch((e) => log(`中转画布 ${project.id} 没有删掉：${e.message}`));
    }
  }

  /** 按线上已有的素材重排画布，不上传。发完核对素材是不是原来那批，不是就整体停下（见文件头）。 */
  async function rearrange(item, demoId, before, finish) {
    if (!before) { log(`跳过 ${demoId} ${item.name}：已下线，读不到线上画布。换素材重新发布时用 force。`); return; }
    const { uploaded, inputAsset } = publishedAssets(before);
    if (!uploaded.length) throw new Error('线上画布里找不到生成结果');
    if (item.input?.sample && !inputAsset) throw new Error('线上画布里找不到参考图');
    const doc = buildDoc(item, uploaded, inputAsset);
    if (dry) { log(`[dry-run] ${demoId} ${item.name} 按线上素材重排：${uploaded.length} 个结果${inputAsset ? '，1 张参考图' : ''}`); return; }
    await publishDoc(demoId, item, doc);
    const after = (await api('/demos/examples')).find((row) => row.id === demoId)?.doc;
    const old = keysOf(before), now = keysOf(after);
    if (now.size !== old.size || [...now].some((key) => !old.has(key))) {
      throw Object.assign(new Error(`发布后素材换了一批，服务端还不是「示例目录里的素材原样留用」那一版。已停止，后面的条目没有发；这一条用户做同款的画布可能打不开，需要人工处理。`), { stop: true });
    }
    await finish();
    log(`已重排 ${demoId} ${item.name}（素材原样，未上传）`);
  }

  async function publish(item, order, folder, existing, live) {
    const demoId = `IPD-insp-${item.id}`;
    const finish = async () => {
      await api(`/demos/${demoId}`, json('POST', { name: item.name, summary: item.summary, sortOrder: 100 + order }));
      await api(`/demos/${demoId}/enabled`, json('POST', { enabled: !item.hold }));
    };
    if (existing.has(demoId) && !force) {
      if (rebuild) return rearrange(item, demoId, live.get(demoId), finish);
      if (dry) { log(`[dry-run] ${demoId} ${item.name} 已发布，只更新名称和排序`); return; }
      await finish();
      log(`已更新 ${demoId} ${item.name}（只更新名称、说明、排序、上下线；重排画布加 rebuild，换素材加 force）`);
      return;
    }
    const input = item.input?.sample;
    for (const [skill, file] of [...item.samples.map((file) => [item.skill, file]), ...(input ? [[input.skill, input.file]] : [])]) {
      if (!await host.has(skill, file)) throw new Error(`素材不存在：${skill}/${file}`);
    }
    if (dry) { log(`[dry-run] ${demoId} ${item.name} ${item.samples.length} 个素材${item.hold ? '（下线）' : ''}`); return; }

    const uploaded = [];
    for (const file of item.samples) uploaded.push(await upload(item.skill, file, item.kind, folder));
    const inputAsset = input ? await upload(input.skill, input.file, 'image', folder) : undefined;

    await publishDoc(demoId, item, buildDoc(item, uploaded, inputAsset));
    // 图片示例的封面就是示例图本身；视频要给一张静帧，否则卡片要先下载视频才有画面。
    if (item.kind === 'video') await api(`/covers/template/${demoId}`, form(await host.poster(item.skill, item.samples[0], uploaded[0].seconds), 'poster.jpg'));
    await finish();
    log(`已发布 ${demoId} ${item.name}${item.hold ? '（保持下线）' : ''}`);
  }

  const items = INSPIRATIONS.filter((item) => !only || only.includes(item.id));
  if (!items.length) throw new Error('没有匹配的条目');
  if (rebuild && force) throw new Error('rebuild 和 force 只能选一个');
  const folder = dry ? undefined : await folderId();
  // rebuild 的 dry-run 也要读线上：它核对的就是线上画布里有没有素材可用。
  const existing = new Set(dry && !rebuild ? [] : (await api('/demos')).map((row) => row.id));
  const live = new Map(rebuild ? (await api('/demos/examples')).map((row) => [row.id, row.doc]) : []);
  let failed = 0, done = 0;
  for (const item of items) {
    try { await publish(item, INSPIRATIONS.indexOf(item), folder, existing, live); done++; }
    catch (error) {
      failed++; log(`失败 ${item.id}：${error.message}`);
      if (error.stop) break;
    }
  }
  const skipped = items.length - done - failed;
  log(`完成：${done} 条成功，${failed} 条失败${skipped ? `，${skipped} 条未处理` : ''}。`);
  return failed;
}
