import { apiFetch, ApiError } from '@ai-star-eco/api-client';
import type { StudioMediaImportResult } from '@ai-star-eco/types';

export type StudioUploadResponse = StudioMediaImportResult | { jobId: string };
type MediaJob = {
  id: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  result?: StudioMediaImportResult;
  errorCode?: string;
  errorMessage?: string;
};

export type StudioMediaJobNotice = {
  id: string;
  title: string;
  status: MediaJob['status'];
  message?: string;
  retry?: (accepted: boolean) => void;
};

export const STUDIO_MEDIA_JOB_NOTICE = 'studio-media-job-notice';
const publish = (detail: StudioMediaJobNotice) => window.dispatchEvent(new CustomEvent(STUDIO_MEDIA_JOB_NOTICE, { detail }));
const retryJob = (id: string) => apiFetch<MediaJob>(`/v1/ip-studio/media/jobs/${encodeURIComponent(id)}/retry`, { method: "POST" });
const readJob = (id: string) => apiFetch<MediaJob>(`/v1/ip-studio/media/jobs/${encodeURIComponent(id)}`);

export async function waitForStudioMediaJob(initial: MediaJob, title: string): Promise<StudioMediaImportResult> {
  let job = initial;
  let consecutiveFailures = 0;
  let publishedStatus: MediaJob['status'] | undefined;
  try {
    for (;;) {
      if (job.status === 'done' && job.result) return job.result;
      if (job.status === 'failed') {
        const message = job.errorMessage || '视频处理未完成，请重试';
        const accepted = await new Promise<boolean>(resolve => publish({ id: job.id, title, status: 'failed', message, retry: resolve }));
        if (!accepted) throw new ApiError({ code: job.errorCode || 'STUDIO_VIDEO_PROCESSING_FAILED', message });
        job = await retryJob(job.id);
        publishedStatus = undefined;
        continue;
      }
      if (publishedStatus !== job.status) {
        publish({ id: job.id, title, status: job.status });
        publishedStatus = job.status;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        job = await readJob(job.id);
        consecutiveFailures = 0;
      } catch (error) {
        if (error instanceof ApiError && error.status && error.status < 500 || ++consecutiveFailures >= 4) throw error;
      }
    }
  } finally { publish({ id: job.id, title, status: 'done' }); }
}

export function finishStudioMediaUpload(result: StudioUploadResponse, title: string) {
  if (result && 'jobId' in result && result.jobId) return waitForStudioMediaJob({ id: result.jobId, status: 'queued' }, title);
  return Promise.resolve(result as StudioMediaImportResult);
}

export const studioVideoInfo = (key: string) =>
  apiFetch<{ durationSec: number }>('/v1/ip-studio/media/video-info', { query: { key } });

export async function clipStudioVideo(storageKey: string, title: string, start: number, end: number, requestId: string) {
  const job = await apiFetch<MediaJob>('/v1/ip-studio/media/clips', { method: "POST", body: { storageKey, title, start, end, requestId } });
  return waitForStudioMediaJob(job, '截取视频片段');
}
