import { AlertTriangle, Loader2 } from "lucide-react";

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="min-h-[360px] rounded-2xl border border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl flex items-center justify-center text-sm text-gray-400">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function ErrorPanel({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="min-h-[360px] rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl flex items-center justify-center">
      <div className="max-w-md text-center px-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {detail ? <p className="mt-2 text-sm text-gray-400">{detail}</p> : null}
      </div>
    </div>
  );
}
