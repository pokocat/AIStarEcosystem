// 本机素材的类型、尺寸和静帧。只有 Node 这一侧用（publish.mjs、serve.mjs）。

import { execFileSync } from 'node:child_process';
import { basename, join } from 'node:path';

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };
export const mimeOf = (file) => MIME[file.slice(file.lastIndexOf('.')).toLowerCase()];

export function probe(path) {
  const out = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', path], { encoding: 'utf8' }));
  return { width: out.streams[0].width, height: out.streams[0].height, seconds: Number(out.format?.duration) || 0 };
}

/** 卡片和弹窗的静帧。取中段：第一帧常常是黑场，或者主体还没进画面。 */
export function posterOf(path, seconds, dir) {
  const target = join(dir, `${basename(path)}.poster.jpg`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(seconds * 0.6), '-i', path, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3', target]);
  return target;
}
