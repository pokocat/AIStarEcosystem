import { CelebrityZoneTopBar } from "@/components/celebrity-zone/CelebrityZoneTopBar";

/**
 * 明星专区共享 Shell：
 *   所有 /producer/celebrity-zone/** 子路由共享顶部（标题 + 面包屑 + ZONE_TABS + 进行中任务徽章）。
 *   解决"进入生成页后顶部 tab 消失"的导航断裂问题，并把进行中任务徽章常驻顶栏。
 */
export default function CelebrityZoneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <CelebrityZoneTopBar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
