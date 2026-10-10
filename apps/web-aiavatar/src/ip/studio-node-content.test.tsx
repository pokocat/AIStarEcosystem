// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {StudioNodeContent} from './studio-node-content';
import type {CanvasNodeData} from '@/canvas/types/canvas';
afterEach(cleanup);
test('a node action does not start canvas dragging and dispatches its exact conversation',()=>{
  const drag=vi.fn(),command=vi.fn();window.addEventListener('studio-command',command);
  const node={id:'copied-dialogue',type:'text',title:'继续创作',position:{x:80,y:80},width:420,height:300,metadata:{studio:{kind:'assistant',conversation:{mode:'director',turns:[]}}}} as CanvasNodeData;
  render(<div onMouseDown={drag} onPointerDown={drag}><StudioNodeContent node={node}/></div>);
  const button=screen.getByRole('button',{name:'打开对话'});fireEvent.pointerDown(button);fireEvent.mouseDown(button);fireEvent.click(button);
  expect(drag).not.toHaveBeenCalled();expect(command).toHaveBeenCalledOnce();expect(command.mock.calls[0][0].detail).toEqual({action:'assistant',nodeId:'copied-dialogue'});
  window.removeEventListener('studio-command',command);
});
