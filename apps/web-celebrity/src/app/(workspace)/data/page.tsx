import { CelebrityDataCenter } from "@/components/celebrity-zone/CelebrityDataCenter";
import { ZONE_OVERVIEW } from "@/mocks/celebrity-zone";

export default function CelebrityDataPage() {
  return <CelebrityDataCenter overview={ZONE_OVERVIEW} />;
}
