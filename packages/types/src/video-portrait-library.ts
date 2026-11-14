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

/** 已通过审核、进入官方素材库的人像图片。person = 已通过本人人脸核验；virtual = 已通过虚拟人像审核。 */
export type VideoPortraitVerified = { key: string; placement: 'person' | 'virtual' };
