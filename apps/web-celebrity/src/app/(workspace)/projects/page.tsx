"use client";

// v0.37+：我的项目接通真后端（listProjects + listStars）。USE_MOCK=1 时回退 mocks。

import * as React from "react";
import { CelebrityMyProjects } from "@/components/celebrity-zone/CelebrityMyProjects";
import { listProjects, listStars } from "@/api/celebrity-zone";
import type { CelebrityProject, CelebrityStar } from "@ai-star-eco/types/celebrity-zone";

export default function CelebrityProjectsPage() {
  const [projects, setProjects] = React.useState<CelebrityProject[]>([]);
  const [stars, setStars] = React.useState<CelebrityStar[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, s] = await Promise.all([listProjects(), listStars()]);
        if (cancelled) return;
        setProjects(p);
        setStars(s);
      } catch {
        // 失败时保持空态，避免生产环境显示本地 mock 数据。
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <CelebrityMyProjects initialProjects={projects} stars={stars} />;
}
