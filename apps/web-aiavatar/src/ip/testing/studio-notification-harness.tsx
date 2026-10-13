import { useEffect, useState } from 'react';
import { render } from '@testing-library/react';
import { subscribeStudioErrors, type StudioError } from '../studio-errors';

/** AntD is stubbed by panel tests; observe the global layer independently of the panel under test. */
export function mountStudioErrorNotifications(onError?: (message: string) => void) {
  function Host() {
    const [errors, setErrors] = useState<StudioError[]>([]);
    useEffect(() => subscribeStudioErrors(error => {
      onError?.(error.message);
      setErrors(current => [...current.filter(item => (item.taskId || item.logId || item.message) !== (error.taskId || error.logId || error.message)), error]);
    }), []);
    return <aside aria-label="全局错误通知">{errors.map(error => <section role="alert" key={error.taskId || error.logId || error.message}><p>{error.message}</p><dl><dt>错误码</dt><dd>{error.code}</dd><dt>logId</dt><dd>{error.logId || '未记录'}</dd></dl></section>)}</aside>;
  }
  return render(<Host/>);
}
