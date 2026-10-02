import { LoadingBlock } from "@/components/common";

export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <LoadingBlock rows={1} height={64} label="正在加载数字人演员…" />
      <LoadingBlock rows={1} height={120} />
      <LoadingBlock rows={3} height={160} />
    </div>
  );
}
