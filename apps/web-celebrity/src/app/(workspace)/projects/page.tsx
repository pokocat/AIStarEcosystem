import { CelebrityMyProjects } from "@/components/celebrity-zone/CelebrityMyProjects";
import { CELEBRITY_PROJECTS, MARKET_STARS } from "@/mocks/celebrity-zone";

export default function CelebrityProjectsPage() {
  return <CelebrityMyProjects initialProjects={CELEBRITY_PROJECTS} stars={MARKET_STARS} />;
}
