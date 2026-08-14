#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/check-wire-mirror.mjs
//
// 校验「Java DTO record ↔ TypeScript interface」的 wire 镜像是否字段级一致。
//
// 为什么需要它：ClipDtos.java 顶上写着 "packages/types/src/clip.ts 的 Spring wire
// 镜像；字段名与可空性保持一致"，但在此之前没有任何东西在执行这句话。结果是
// AssetDto.bytes 与 CaptureRequirementsDto.authorizationVideoRequired 两个字段
// 服务端一直在下发、TS 镜像里却根本不存在——端上只能靠「反正真的会发」硬读。
// 声明了契约就得有东西钉住它，否则那行注释只是愿望。
//
// 报什么：
//   - java-only：服务端下发、TS 没声明 → 消费方要么瞎读要么根本不知道有这个字段
//   - ts-only  ：TS 声明了、服务端不发 → 契约在骗人，端上会写出永远取不到的分支
//   - 未映射的 record：没有对应 interface（内联在别的 interface 里的除外，见 INLINED）
//
// 用法（在仓库根运行）：
//   node scripts/check-wire-mirror.mjs
//   pnpm check:wire-mirror
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");

// 每组镜像：Java DTO 容器类 ↔ TS 类型文件 ↔ record→interface 映射。
// 新增一组镜像时在这里加一项即可。
const MIRRORS = [
  {
    label: "clip",
    java: "apps/server/src/main/java/com/aistareco/aep/clip/dto/ClipDtos.java",
    ts: "packages/types/src/clip.ts",
    pairs: {
      TemplateDto: "ClipTemplate",
      ProjectDto: "ClipProject",
      EstimateDto: "ClipEstimate",
      RenderResult: "ClipRenderResult",
      JobDto: "ClipJob",
      AssetDto: "ClipAsset",
      AssetStorageDto: "ClipAssetStorage",
      WorkDto: "ClipWork",
      AvatarDto: "ClipAvatarView",
      VoiceDto: "ClipVoiceView",
      CaptureRuleDto: "ClipCaptureRule",
      CaptureRequirementsDto: "ClipCaptureRequirements",
      ConsentDto: "ClipConsentResult",
      AuditDto: "ClipAuditEntry",
    },
    // TS 侧把这些 record 内联成了匿名对象类型（如 ClipEstimate.items / .summary），
    // 不是独立 interface，因此不参与逐字段比对。
    inlined: ["EstimateItem", "EstimateSummary"],
  },
];

// ── 解析 ────────────────────────────────────────────────────────────────────

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

/** 反复剥掉最内层的 <…> 与 {…}，直到不动为止——单趟替换剥不干净嵌套泛型/嵌套对象。 */
function stripNested(src) {
  let prev;
  do {
    prev = src;
    src = src.replace(/<[^<>]*>/g, "").replace(/\{[^{}]*\}/g, "");
  } while (src !== prev);
  return src;
}

/** 从 open 处向后做括号配平扫描，返回配平位置（不含收尾括号）。 */
function balancedEnd(src, from, open, close) {
  let depth = 1;
  let i = from;
  while (i < src.length && depth > 0) {
    if (src[i] === open) depth += 1;
    else if (src[i] === close) depth -= 1;
    i += 1;
  }
  return i - 1;
}

/** public record Foo(A a, List<B> b) → ["a", "b"]（按声明顺序）。 */
function javaRecords(src) {
  const out = new Map();
  const re = /\brecord\s+(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const from = m.index + m[0].length;
    const body = src.slice(from, balancedEnd(src, from, "(", ")"));
    const fields = stripNested(body)
      .split(",")
      .map((part) => part.trim().split(/\s+/).pop())
      .filter((name) => /^\w+$/.test(name));
    out.set(m[1], fields);
  }
  return out;
}

/** export interface Foo { a: X; b?: Y } → ["a", "b"]（索引签名与嵌套对象的键不算）。 */
function tsInterfaces(src) {
  const out = new Map();
  const re = /export interface (\w+)\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const from = m.index + m[0].length;
    const body = stripNested(src.slice(from, balancedEnd(src, from, "{", "}")));
    const fields = [...body.matchAll(/(?:^|[;\n])\s*(\w+)\s*\??\s*:/g)].map((x) => x[1]);
    out.set(m[1], fields);
  }
  return out;
}

// ── 比对 ────────────────────────────────────────────────────────────────────

function checkMirror(mirror) {
  const javaSrc = stripComments(readFileSync(join(REPO_ROOT, mirror.java), "utf8"));
  const tsSrc = stripComments(readFileSync(join(REPO_ROOT, mirror.ts), "utf8"));
  const records = javaRecords(javaSrc);
  const interfaces = tsInterfaces(tsSrc);

  const drift = [];
  const missing = [];
  for (const [recordName, interfaceName] of Object.entries(mirror.pairs)) {
    const javaFields = records.get(recordName);
    const tsFields = interfaces.get(interfaceName);
    if (!javaFields) {
      missing.push(`record ${recordName} 不在 ${mirror.java}（映射表过期了？）`);
      continue;
    }
    if (!tsFields) {
      missing.push(`interface ${interfaceName} 不在 ${mirror.ts}（record ${recordName} 没有镜像）`);
      continue;
    }
    const javaOnly = javaFields.filter((f) => !tsFields.includes(f));
    const tsOnly = tsFields.filter((f) => !javaFields.includes(f));
    if (javaOnly.length || tsOnly.length) {
      drift.push({ recordName, interfaceName, javaOnly, tsOnly });
    }
  }

  const known = new Set([...Object.keys(mirror.pairs), ...mirror.inlined]);
  const unmapped = [...records.keys()].filter((name) => !known.has(name));
  return { drift, missing, unmapped, recordCount: records.size };
}

function main() {
  console.log("─".repeat(72));
  console.log("Wire mirror check — Java DTO record ↔ TypeScript interface");
  console.log("─".repeat(72));

  let failed = 0;
  for (const mirror of MIRRORS) {
    const { drift, missing, unmapped, recordCount } = checkMirror(mirror);
    const pairCount = Object.keys(mirror.pairs).length;
    console.log(`\n[${mirror.label}]  ${pairCount} pair(s) from ${recordCount} record(s)`);
    console.log(`  java : ${mirror.java}`);
    console.log(`  ts   : ${mirror.ts}`);

    if (missing.length) {
      failed += missing.length;
      console.log(`\n  ❌  映射缺失 (${missing.length}):`);
      for (const line of missing) console.log(`      ${line}`);
    }

    if (drift.length === 0) {
      console.log("\n  ✓  每一对 record/interface 都字段级一致。");
    } else {
      failed += drift.length;
      console.log(`\n  ❌  字段漂移 (${drift.length}):`);
      for (const d of drift) {
        console.log(`      ${d.recordName} ↔ ${d.interfaceName}`);
        if (d.javaOnly.length) {
          console.log(`         java-only : ${d.javaOnly.join(", ")}`);
          console.log("                     服务端在发、TS 没声明 —— 消费方读不到或只能硬读");
        }
        if (d.tsOnly.length) {
          console.log(`         ts-only   : ${d.tsOnly.join(", ")}`);
          console.log("                     TS 声明了、服务端不发 —— 契约在骗人");
        }
      }
    }

    if (unmapped.length) {
      console.log(`\n  ⚠  未纳入映射的 record (${unmapped.length}): ${unmapped.join(", ")}`);
      console.log("     要么在 MIRRORS.pairs 里补上对应 interface，要么加进 inlined 说明它是内联的。");
    }
  }

  console.log();
  if (failed > 0) {
    console.error(
      `FAIL: ${failed} 处镜像不一致。改 DTO 就要同步改 TS 镜像——` +
        "两端字段集必须完全相同（可空性也要对齐）。",
    );
    process.exit(1);
  }
  console.log("OK.");
}

main();
