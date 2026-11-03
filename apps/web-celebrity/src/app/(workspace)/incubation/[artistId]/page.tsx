import { notFound } from "next/navigation";
import { ArtistDetail } from "@/components/incubation/ArtistDetail";
import { findArtist } from "@/mocks/incubation";

export default async function IncubationArtistPage({ params }: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await params;
  const artist = findArtist(artistId);
  if (!artist) notFound();
  return <ArtistDetail artist={artist} />;
}
