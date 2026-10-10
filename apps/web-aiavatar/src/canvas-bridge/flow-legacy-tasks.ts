import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { nanoid } from 'nanoid';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { resumableImageRuns, applyCandidateToNode } from '@/canvas/lib/canvas/canvas-generation-helpers';
import { imageMetadata, videoMetadata } from '@/canvas/lib/canvas/canvas-node-factory';
import { resumeRun } from './generation';
import { uploadImage } from './image-storage';
import { waitForVideoGenerationTask, storeGeneratedVideo } from './video';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';

/** Resume accepted legacy work after the UI migration. This module never submits a generation. */
export function useFlowLegacyTasks(projectId: string, setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>) {
  useEffect(() => {
    const controller = new AbortController();
    const nodes = useCanvasStore.getState().projects.find(p => p.id === projectId)?.nodes || [];
    for (const node of nodes) {
      if (node.metadata?.studio?.request || node.metadata?.studio?.speechRequest || node.metadata?.studio?.lipSyncRequest) continue;
      const images = resumableImageRuns(node), taskId = node.metadata?.videoTaskId;
      if (!images.length && !taskId) continue;
      setNodes(current => current.map(n => n.id === node.id ? { ...n, metadata: { ...n.metadata, status: 'loading' } } : n));
      void (async () => {
        try {
          if (taskId) {
            const video = await storeGeneratedVideo(await waitForVideoGenerationTask(undefined, { id: taskId, provider: node.metadata?.videoTaskProvider || 'plugin', model: node.metadata?.model || '' }, { signal: controller.signal }));
            if (controller.signal.aborted) return;
            setNodes(current => current.map(n => {
              if (n.id !== node.id) return n;
              const id = nanoid();
              return { ...n, metadata: { ...n.metadata, ...videoMetadata(video), videoTaskId: undefined,
                primaryVideoId: id, videos: [...(n.metadata?.videos || []), { id, status: 'success', storageKey: video.storageKey, content: video.url, mimeType: video.mimeType }] } };
            }));
          } else {
            for (const { runId, imageId } of images) {
              const [image] = await resumeRun(runId, { signal: controller.signal });
              const uploaded = await uploadImage(image.dataUrl, { signal: controller.signal });
              if (controller.signal.aborted) return;
              setNodes(current => imageId ? applyCandidateToNode(current, node.id, imageId, uploaded, runId, Math.max(node.width, node.height)) :
                current.map(n => n.id === node.id ? { ...n, metadata: { ...n.metadata, ...imageMetadata(uploaded), runId } } : n));
            }
            setNodes(current => current.map(n => n.id === node.id ? { ...n, metadata: { ...n.metadata, status: 'success' } } : n));
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          // A network observation failure never discards the original task identity.
          setNodes(current => current.map(n => n.id === node.id ? { ...n, metadata: { ...n.metadata, status: 'error', errorDetails: error instanceof Error ? error.message : '原任务暂未读取，请刷新后继续确认' } } : n));
        }
      })();
    }
    return () => controller.abort();
  }, [projectId, setNodes]);
}
