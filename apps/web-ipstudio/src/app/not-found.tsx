import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "var(--canvas)" }}>
      <span className="reg">404</span>
      <h1 className="asset-name text-[24px]" style={{ color: "var(--ink)" }}>这个页面不在这儿</h1>
      <p className="text-[13px] max-w-sm" style={{ color: "var(--ink-2)" }}>
        链接可能过期了，或者这个项目已经被删除。
      </p>
      <Link
        href="/projects"
        className="px-4 py-2 rounded-xl text-[13px] font-bold"
        style={{ background: "var(--primary)", color: "var(--on-primary)" }}
      >
        回到项目列表
      </Link>
    </div>
  );
}
