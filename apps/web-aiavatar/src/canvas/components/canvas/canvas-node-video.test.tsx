// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {CanvasNode} from './canvas-node';
vi.mock('react-i18next',async importOriginal=>({...await importOriginal<typeof import('react-i18next')>(),useTranslation:()=>({t:(s:string)=>s})}));
vi.mock('@/canvas/stores/use-theme-store',()=>({useThemeStore:()=> 'light'}));
afterEach(cleanup);
test.each(['loading','error'])('keeps adopted playback visible when a replacement batch is %s',status=>{
 const data={id:'v',type:'video',title:'v',position:{x:0,y:0},width:320,height:400,metadata:{status,storageKey:'adopted.mp4',content:'/adopted.mp4',primaryVideoId:'old',videos:[{id:'old',status:'success',storageKey:'adopted.mp4',content:'/adopted.mp4'}]}};
 const {container}=render(<CanvasNode {...({data,scale:1,isSelected:false,isRelated:false,isFocusRelated:false,isConnecting:false,isConnectionTarget:false,showImageInfo:false} as any)}/>);
 expect(container.querySelector('video')?.getAttribute('src')).toBe('/adopted.mp4');expect(screen.getByRole('status').textContent).toContain(status==='loading'?'本批生成中':'本批生成失败');
});
