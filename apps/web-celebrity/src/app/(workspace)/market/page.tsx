import { CelebrityMarketHero } from "@/components/celebrity-zone/CelebrityMarketHero";
import { CelebrityMarket } from "@/components/celebrity-zone/CelebrityMarket";
import { MARKET_STARS, ZONE_OVERVIEW } from "@/mocks/celebrity-zone";

export default function CelebrityMarketPage() {
  return (
    <div className="flex flex-col gap-6">
      <CelebrityMarketHero
        totalPlays={ZONE_OVERVIEW.hero.totalPlays}
        totalConversions={ZONE_OVERVIEW.hero.totalConversions}
        activeStars={ZONE_OVERVIEW.hero.activeStars}
      />
      <CelebrityMarket stars={MARKET_STARS} />
    </div>
  );
}
