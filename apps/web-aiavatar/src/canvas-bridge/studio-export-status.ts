export function studioExportStatus(stage?: string): string {
  return !stage || stage === 'queued' || stage === 'studio.export.queued' ? '等待导出' : '正在导出';
}
