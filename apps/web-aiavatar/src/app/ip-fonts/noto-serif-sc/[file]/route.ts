// Same-origin delivery for our OSS-hosted display font; the bucket is not opened with new CORS rules.
const FONT_BASE = "https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/ipstudio/fonts/noto-serif-sc-v36/";
const FONT_FILE = /^[A-Za-z0-9_-]+(?:\.[0-9]+)?\.woff2$/;

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!FONT_FILE.test(file)) return new Response(null, { status: 404 });
  try {
    const upstream = await fetch(FONT_BASE + file, { cache: "force-cache", next: { revalidate: 2592000 }, signal: AbortSignal.timeout(10000) });
    if (!upstream.ok) return new Response(null, { status: upstream.status === 404 ? 404 : 502 });
    return new Response(await upstream.arrayBuffer(), {
      headers: { "Content-Type": "font/woff2", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    // CSS retains the system serif fallback when a font shard cannot be fetched.
    return new Response(null, { status: 502 });
  }
}
