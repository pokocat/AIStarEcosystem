'use client';

import { useEffect } from 'react';
import { Button, notification } from 'antd';
import { STUDIO_MEDIA_JOB_NOTICE, type StudioMediaJobNotice } from '@/canvas-bridge/studio-media-jobs';

export function StudioMediaNotices() {
  const [api, holder] = notification.useNotification({ placement: 'topRight', top: 64 });
  useEffect(() => {
    const show = (event: Event) => {
      const notice = (event as CustomEvent<StudioMediaJobNotice>).detail;
      if (notice.status === 'done') { api.destroy(notice.id); return; }
      if (notice.status === 'failed') {
        api.error({ key: notice.id, title: notice.message || '视频处理未完成', description: notice.title, duration: 0,
          onClose: () => notice.retry?.(false),
          actions: <Button size="small" type="primary" onClick={() => notice.retry?.(true)}>重试</Button> });
      } else {
        api.info({ key: notice.id, title: notice.status === 'queued' ? '视频等待处理' : '正在处理视频',
          description: notice.title, duration: 0, closeIcon: null, role: 'status' });
      }
    };
    window.addEventListener(STUDIO_MEDIA_JOB_NOTICE, show);
    return () => window.removeEventListener(STUDIO_MEDIA_JOB_NOTICE, show);
  }, [api]);
  return holder;
}
