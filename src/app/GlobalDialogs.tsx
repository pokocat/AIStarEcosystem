import ArtistDetailDialog from '../components/ArtistDetailDialog';
import ArtistListingDialog from '../components/ArtistListingDialog';
import ArtistSigningDialog from '../components/ArtistSigningDialog';
import MusicGenerationDialog from '../components/MusicGenerationDialog';
import NFTMintingDialog from '../components/NFTMintingDialog';
import OnboardingGuide from '../components/OnboardingGuide';
import { useAppShell } from '../state/appShellStore';

const mockArtist = {
  id: 1,
  name: 'Astra Nova',
  style: 'Hyperpop',
  avatar: 'https://picsum.photos/seed/artist/128/128',
  price: '¥8,800',
  owner: 'demo_owner',
  songs: 12,
  followers: '52.3K',
};

export function GlobalDialogs() {
  const { dialogs, closeDialog } = useAppShell();

  return (
    <>
      <MusicGenerationDialog isOpen={dialogs.musicGeneration} onClose={() => closeDialog('musicGeneration')} onSuccess={() => closeDialog('musicGeneration')} lang="zh" />
      <NFTMintingDialog isOpen={dialogs.nftMinting} onClose={() => closeDialog('nftMinting')} onSuccess={() => closeDialog('nftMinting')} lang="zh" />
      <ArtistSigningDialog isOpen={dialogs.artistSigning} artist={mockArtist} onClose={() => closeDialog('artistSigning')} onSuccess={() => closeDialog('artistSigning')} lang="zh" />
      <ArtistDetailDialog isOpen={dialogs.artistDetail} artist={mockArtist} onClose={() => closeDialog('artistDetail')} lang="zh" />
      <ArtistListingDialog isOpen={dialogs.artistListing} artist={mockArtist} onClose={() => closeDialog('artistListing')} onSuccess={() => closeDialog('artistListing')} lang="zh" />
      <OnboardingGuide isOpen={dialogs.onboarding} onComplete={() => closeDialog('onboarding')} lang="zh" />
    </>
  );
}
