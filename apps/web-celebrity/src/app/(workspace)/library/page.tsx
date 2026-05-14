import { CelebrityVideoLibrary } from "@/components/celebrity-zone/CelebrityVideoLibrary";
import { CELEBRITY_PROJECTS, MARKET_STARS, PROJECT_VIDEOS_MAP } from "@/mocks/celebrity-zone";

export default function CelebrityLibraryPage() {
  const allVideos = Object.values(PROJECT_VIDEOS_MAP).flat();
  return <CelebrityVideoLibrary videos={allVideos} stars={MARKET_STARS} projects={CELEBRITY_PROJECTS} />;
}
