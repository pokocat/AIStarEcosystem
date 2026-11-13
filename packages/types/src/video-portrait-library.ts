/** Official video portrait verification; vendor tokens and credentials never leave the server. */
export type VideoPortraitItem = {
  id: string; libraryId: string; key: string; mediaType: string; label: string; previewUrl?: string;
  status: 'needs_review' | 'queued' | 'uploading' | 'processing' | 'active' | 'failed' | 'revoked';
  placement?: 'virtual' | 'person'; personId?: string; errorMessage?: string; updatedAt: string;
  submissionUnknown?: boolean; arkError?: string;
};
export type VideoPortraitDeclaration = { kind: 'virtual' | 'person'; personId?: string; accepted: boolean; agreementVersion: string };
export type VideoPortraitPerson = {
  id: string; libraryId: string; name: string; status: 'verifying' | 'active' | 'failed' | 'revoked';
  verificationUrl?: string; expiresAt: string; createdAt: string; arkError?: string;
};
export type VideoPortraitOverview = {
  libraries: { id: string; name: string }[]; items: VideoPortraitItem[]; persons: VideoPortraitPerson[];
  agreement: { version: string; text: string; virtualDeclaration: string };
};

export type VideoPortraitReview = { jobId: string; items: VideoPortraitItem[]; awaiting: boolean; canContinue: boolean };
export type VideoPortraitReviewLink = { jobId: string; reviewId?: string };

export type VideoPortraitPreparation = { libraryId?: string; items: VideoPortraitItem[]; candidateKeys: string[] };
