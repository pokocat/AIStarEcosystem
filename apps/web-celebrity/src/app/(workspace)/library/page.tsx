"use client";

// v0.37+：视频中心接通真后端（listAllVideos + listProjects + listStars）。USE_MOCK=1 回退 mocks。

import * as React from "react";
import { CelebrityVideoLibrary } from "@/components/celebrity-zone/CelebrityVideoLibrary";
import { listAllVideos, listProjects, listStars } from "@/api/celebrity-zone";
import { CELEBRITY_PROJECTS, MARKET_STARS, PROJECT_VIDEOS_MAP } from "@/mocks/celebrity-zone";
import type {
  CelebrityProject,
  CelebrityProjectVideo,
  CelebrityStar,
} from "@ai-star-eco/types/celebrity-zone";

export default function CelebrityLibraryPage() {
  const fallbackVideos = React.useMemo(() => Object.values(PROJECT_VIDEOS_MAP).flat(), []);
  const [videos, setVideos] = React.useState<CelebrityProjectVideo[]>(fallbackVideos);
  const [stars, setStars] = React.useState<CelebrityStar[]>(MARKET_STARS);
  const [projects, setProjects] = React.useState<CelebrityProject[]>(CELEBRITY_PROJECTS);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, p, s] = await Promise.all([listAllVideos(), listProjects(), listStars()]);
        if (cancelled) return;
        if (v.length > 0) setVideos(v);
        if (p.length > 0) setProjects(p);
        if (s.length > 0) setStars(s);
      } catch {
        // 失败静默回退 mocks
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <CelebrityVideoLibrary videos={videos} stars={stars} projects={projects} />;
}
