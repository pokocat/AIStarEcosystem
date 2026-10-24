// AI 导演台工作台 —— server 外壳只负责 await params（Next 16：params 是 Promise）。
import { DirectorWorkbench } from "@/ip/director/director-workbench";
import { DirectorAntd } from "@/ip/director/director-antd";

export default async function DirectorWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DirectorAntd><DirectorWorkbench id={id}/></DirectorAntd>;
}
