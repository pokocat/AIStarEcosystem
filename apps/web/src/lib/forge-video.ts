const FORGE_VIDEO_FILENAMES = [
  "showreel-01.mp4",
  "showreel-02.mp4",
  "showreel-03.mp4",
  "showreel-04.mp4",
  "showreel-05.mp4",
] as const;

const DEFAULT_FORGE_VIDEO_BASE = "/static/videos";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getForgeVideoBase(): string {
  return trimTrailingSlash(
    process.env.NEXT_PUBLIC_FORGE_VIDEO_BASE || DEFAULT_FORGE_VIDEO_BASE,
  );
}

export const DEMO_FORGE_VIDEO_POOL: string[] = FORGE_VIDEO_FILENAMES.map(
  filename => `${getForgeVideoBase()}/${filename}`,
);

export function pickDemoForgeVideo(): string {
  return DEMO_FORGE_VIDEO_POOL[Math.floor(Math.random() * DEMO_FORGE_VIDEO_POOL.length)];
}
