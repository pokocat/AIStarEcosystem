import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {GenerationSubmissionAlerts} from './generation-alerts';
import {readGenerationAlerts} from '@/api/generation-alerts';
vi.mock('@/api/generation-alerts',()=>({readGenerationAlerts:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const record={taskType:'material-video',taskId:'original-job',endpointId:'provider',createdAt:'2026-10-22T10:00:00Z',status:'failed',errorCode:'VIDEO_SUBMISSION_UNKNOWN',errorMessage:'HTTP 503',logId:'ABCDEF234567',modelContext:'供应商 / 端点：聚算\nAPI 基础地址：https://api.example/v1\n模型：minimax-h3\n任务参数：duration_sec=13'};
test('shows closed incidents and original diagnostics, with read-only refresh and server pagination',async()=>{
 vi.mocked(readGenerationAlerts).mockResolvedValueOnce({items:[record],page:0,total:21,hasMore:true}).mockResolvedValue({items:[],page:1,total:21,hasMore:false});
 render(<GenerationSubmissionAlerts/>);
 await screen.findByText(/已按失败处理/);expect(screen.getByText('HTTP 503')).toBeDefined();expect(screen.getByText('ABCDEF234567')).toBeDefined();
 expect(screen.getByText(/API 基础地址/).textContent).toContain('minimax-h3');
 expect(screen.queryByRole('button',{name:'重新生成'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'下一页'}));await waitFor(()=>expect(readGenerationAlerts).toHaveBeenLastCalledWith(1));
 await screen.findByText('第 2 页');expect((screen.getByRole('button',{name:'下一页'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'刷新告警'}));await waitFor(()=>expect(readGenerationAlerts).toHaveBeenCalledTimes(3));
});
test('surfaces load failure and lets the operator retry without an empty-success claim',async()=>{
 vi.mocked(readGenerationAlerts).mockRejectedValueOnce(new Error('网络中断')).mockResolvedValue({items:[],page:0,total:0,hasMore:false});
 render(<GenerationSubmissionAlerts/>);expect((await screen.findByRole('alert')).textContent).toBe('网络中断');
 expect(screen.queryByText('暂无此类生成异常')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'刷新告警'}));await screen.findByText('暂无此类生成异常');
});
