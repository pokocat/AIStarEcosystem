"use client";

// v0.37+：我的项目接通真后端（listProjects + listStars）。USE_MOCK=1 时回退 mocks。

import * as React from "react";
import { CelebrityMyProjects } from "@/components/celebrity-zone/CelebrityMyProjects";
import { listProjects, listStars } from "@/api/celebrity-zone";
import { CELEBRITY_PROJECTS, MARKET_STARS } from "@/mocks/celebrity-zone";
import type { CelebrityProject, CelebrityStar } from "@ai-star-eco/types/celebrity-zone";

export default function CelebrityProjectsPage() {
  const [projects, setProjects] = React.useState<CelebrityProject[]>(CELEBRITY_PROJECTS);
  const [stars, setStars] = React.useState<CelebrityStar[]>(MARKET_STARS);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, s] = await Promise.all([listProjects(), listStars()]);
        if (cancelled) return;
        if (p.length > 0) setProjects(p);
        if (s.length > 0) setStars(s);
      } catch {
        // 失败时静默回退 mocks（已作为初始 state）
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <CelebrityMyProjects initialProjects={projects} stars={stars} />;
}
