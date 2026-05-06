import * as React from "react";
import { CelebrityMarketHero } from "@/components/celebrity-zone/CelebrityMarketHero";
import { CelebrityMarket } from "@/components/celebrity-zone/CelebrityMarket";
import { CelebrityMyProjects } from "@/components/celebrity-zone/CelebrityMyProjects";
import { CelebrityVideoLibrary } from "@/components/celebrity-zone/CelebrityVideoLibrary";
import { CelebrityDataCenter } from "@/components/celebrity-zone/CelebrityDataCenter";
import { CelebrityProductLibrary } from "@/components/celebrity-zone/CelebrityProductLibrary";
import {
  MARKET_STARS,
  CELEBRITY_PROJECTS,
  PROJECT_VIDEOS_MAP,
  ZONE_OVERVIEW,
} from "@/mocks/celebrity-zone";
import type { ZoneTabId } from "@/constants/celebrity-zone-ui";

interface PageProps {
  searchParams?: Promise<{ tab?: string }>;
}

function resolveTab(raw?: string): ZoneTabId {
  if (
    raw === "projects" ||
    raw === "library" ||
    raw === "data" ||
    raw === "products"
  )
    return raw;
  return "market";
}

export default async function ProducerCelebrityZonePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const active = resolveTab(sp.tab);
  const allVideos = Object.values(PROJECT_VIDEOS_MAP).flat();

  return (
    <div className="flex flex-col gap-6">
      {active === "market" && (
        <div className="flex flex-col gap-6">
          <CelebrityMarketHero
            totalPlays={ZONE_OVERVIEW.hero.totalPlays}
            totalConversions={ZONE_OVERVIEW.hero.totalConversions}
            activeStars={ZONE_OVERVIEW.hero.activeStars}
          />
          <CelebrityMarket stars={MARKET_STARS} />
        </div>
      )}

      {active === "projects" && (
        <CelebrityMyProjects initialProjects={CELEBRITY_PROJECTS} stars={MARKET_STARS} />
      )}

      {active === "products" && <CelebrityProductLibrary />}

      {active === "library" && (
        <CelebrityVideoLibrary
          videos={allVideos}
          stars={MARKET_STARS}
          projects={CELEBRITY_PROJECTS}
        />
      )}

      {active === "data" && <CelebrityDataCenter overview={ZONE_OVERVIEW} />}
    </div>
  );
}
