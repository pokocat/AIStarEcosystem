import { expect, test } from 'vitest';
import { floatingPosition } from './studio-floating-panel';
const stage={left:0,top:60,width:1318,height:780};
test('screen-sized composers sit below a visible node, centered independently of its zoom',()=>{
 const p=floatingPosition(stage,{left:500,top:200,width:320,height:200},{width:660,height:240});
 expect(p).toEqual({left:330,top:352});
});
test('a bottom-edge node uses clear space on the side before clamping into view',()=>{
 const p=floatingPosition(stage,{left:80,top:640,width:240,height:180},{width:660,height:260});
 expect(p.left).toBe(332);expect(p.top).toBe(452);
 expect(p.left+660).toBeLessThan(stage.width);expect(p.top+260).toBeLessThan(stage.height-60);
});
test('a large right-edge node falls above when neither side has room',()=>{
 const p=floatingPosition(stage,{left:700,top:570,width:550,height:200},{width:660,height:260});
 expect(p).toEqual({left:642,top:238});
});
test('node actions stay above their anchor and utility windows respect the tool margins',()=>{
 expect(floatingPosition(stage,{left:500,top:260,width:320,height:200},{width:660,height:48},true)).toEqual({left:330,top:140});
 expect(floatingPosition(stage,undefined,{width:420,height:620})).toEqual({left:874,top:72});
});
