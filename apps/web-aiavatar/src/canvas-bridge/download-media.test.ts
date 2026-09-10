import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sniffExtension } from "./download-media";

const bytes = (...b: number[]) => new Uint8Array([...b, ...Array(16).fill(0)]);

describe("按字节认格式", () => {
  it("PNG / JPEG / WebP / GIF / BMP", () => {
    expect(sniffExtension(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffExtension(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffExtension(new Uint8Array([0x52,0x49,0x46,0x46,1,2,3,4,0x57,0x45,0x42,0x50]))).toBe("webp");
    expect(sniffExtension(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("gif");
    expect(sniffExtension(bytes(0x42, 0x4d))).toBe("bmp");
  });

  it("MP4（ftyp box 在第 5 字节起）", () => {
    expect(sniffExtension(new Uint8Array([0,0,0,0x20,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d]))).toBe("mp4");
  });

  it("认不出就返回 null —— 不猜", () => {
    expect(sniffExtension(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull();
    expect(sniffExtension(new Uint8Array([]))).toBeNull();
  });

  it("**这就是用户报的那个 bug**：内容是 JPEG，名字却叫 .png", () => {
    // 服务端 v0.184 起落库时已按字节改正，但存量文件的 key 仍写着 .png。
    // 下载时按字节判就能下对，不受 key 影响。
    const jpegBytes = bytes(0xff, 0xd8, 0xff, 0xe1);
    expect(sniffExtension(jpegBytes)).toBe("jpg");
  });
});

import { mimeFromKey, extFromUrl } from "./download-media";

describe("类型按服务端的 key 判，不按画布自己记的", () => {
  it("线上真实数据：key 是 .jpg 而文档里 mimeType 写着 image/png", () => {
    // 取自生产 IPD-7bdb45d6 的真实节点
    const key = "ipstudio_demo/IPD-7bdb45d6/6b30f63172dd48c695b8fe55c9313705.jpg";
    expect(mimeFromKey(key)).toBe("image/jpeg");   // 服务端 v0.184 起按字节改正过 key
  });

  it("认得常见图 / 视频 / 音频；认不出返回 undefined", () => {
    expect(mimeFromKey("a/b.png")).toBe("image/png");
    expect(mimeFromKey("media/material-videos/mvj_x/video.mp4")).toBe("video/mp4");
    expect(mimeFromKey("a/b.wav")).toBe("audio/wav");
    expect(mimeFromKey("a/b.xyz")).toBeUndefined();
    expect(mimeFromKey(null)).toBeUndefined();
  });

  it("签名地址要去掉查询串再看后缀", () => {
    expect(extFromUrl("https://oss/x/abc.jpg?Expires=1&Signature=zz")).toBe("jpg");
    expect(extFromUrl("https://oss/x/abc.mp4#t=1")).toBe("mp4");
  });
});

describe("不直连 OSS（桶没配 CORS）", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("导出取字节的两处都走同源，不再裸 fetch 签名地址", () => {
    for (const f of ["src/canvas-bridge/image-storage.ts", "src/canvas-bridge/file-storage.ts"]) {
      const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(src, `${f} 还在直连 OSS —— 会被 CORS 拦，导出就静默丢图`).toContain("fetchAssetBlob");
      expect(src, `${f} 仍有裸 fetch(url)`).not.toMatch(/fetch\(url\)/);
    }
  });

  it("下载有 storageKey 时走同源", () => {
    const src = read("src/canvas-bridge/download-media.ts");
    expect(src).toContain("storageKey ? await fetchAssetBlob(storageKey)");
  });
});
