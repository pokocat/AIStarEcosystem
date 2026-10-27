import { expect, test } from 'vitest';
import { dockedPanelWidth, floatingPanelWidth, floatingPosition } from './studio-floating-panel';
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
test('a node action bar sits right under its node, flush left (canvas redesign), and above it only without room; utility windows respect the tool margins',()=>{
 expect(floatingPosition(stage,{left:500,top:260,width:320,height:200},{width:380,height:48},true)).toEqual({left:500,top:412});
 expect(floatingPosition(stage,{left:500,top:600,width:320,height:200},{width:380,height:48},true)).toEqual({left:500,top:480});
 expect(floatingPosition(stage,undefined,{width:420,height:620})).toEqual({left:874,top:72});
});

test('a docked panel leaves the canvas at least 480px beside the tools, whatever width was remembered',()=>{
 expect(dockedPanelWidth(480,1440)).toBe(480);
 expect(dockedPanelWidth(760,1440)).toBe(760);
 expect(dockedPanelWidth(760,1024)).toBe(488);
 expect(dockedPanelWidth(480,960)).toBe(424);
 // Never narrower than the panel's own minimum, even on a stage too small for both.
 expect(dockedPanelWidth(480,800)).toBe(400);
 expect(dockedPanelWidth(600,0)).toBe(600);
});
test('a floating composer fits the part of the stage a docked panel leaves free',()=>{
 expect(floatingPanelWidth(660,1384)).toBe(660);
 // 1024 viewport, 488px docked assistant: 536px free, the composer shrinks instead of covering the assistant.
 expect(floatingPanelWidth(660,536)).toBe(448);
 expect(floatingPanelWidth(660,300)).toBe(320);
 expect(floatingPanelWidth(660,0)).toBe(660);
});
