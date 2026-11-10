export const normalizeStudioError = (input: unknown) => ({ code: 'PREVIEW', message: input instanceof Error ? input.message : '请重试。' });
export const reportStudioError = () => {};
