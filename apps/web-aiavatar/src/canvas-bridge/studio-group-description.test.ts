import { expect, test } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { describeStudioGroup, GROUP_DESCRIPTION_SPACE } from './studio-group-description';
import { copyFlowSelection } from './flow-document';

test('editing notes reserves header room without moving members; copies keep notes and remap membership', () => {
  const group: CanvasNodeData = { id: 'g', type: CanvasNodeType.Group, title: '换人生成', position: { x: 0, y: 100 }, width: 800, height: 600 };
  const image: CanvasNodeData = { id: 'i', type: CanvasNodeType.Image, title: '人物', position: { x: 24, y: 152 }, width: 320, height: 400, metadata: { groupId: 'g', storageKey: 'own.png' } };
  const nodes = describeStudioGroup([group, image], 'g', ' 步骤一\n步骤二 ');
  expect(nodes[0].metadata?.groupDescription).toBe('步骤一\n步骤二');
  expect(nodes[0].position.y).toBe(100 - GROUP_DESCRIPTION_SPACE);
  expect(nodes[0].height).toBe(600 + GROUP_DESCRIPTION_SPACE);
  expect(nodes[1]).toBe(image);
  const edited = describeStudioGroup(nodes, 'g', '新说明');
  expect(edited[0].position).toEqual(nodes[0].position);
  const copied = copyFlowSelection(edited, [], new Set(['g'])).nodes;
  expect(copied[0].metadata?.groupDescription).toBe('新说明');
  expect(copied[1].metadata?.groupId).toBe(copied[0].id);
  expect(copied[1].metadata?.storageKey).toBe('own.png');
  const cleared = describeStudioGroup(edited, 'g', '');
  expect(cleared[0].position).toEqual(group.position);
  expect(cleared[0].height).toBe(group.height);
  expect(cleared[0].metadata?.groupDescription).toBeUndefined();
});
