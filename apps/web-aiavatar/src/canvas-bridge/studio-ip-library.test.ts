import {expect,test} from 'vitest';
import type {StudioIpAsset} from '@ai-star-eco/types/ip-studio-workflow';
import {filterStudioCharacters,groupStudioIpAssets,ipAssetRole} from './studio-ip-library';
const main:StudioIpAsset={ipId:'ip',avatarId:'a',version:2,storageKey:'main',url:'main',name:'小紫',characterName:'小紫',current:true,path:'ai',assetRole:'main',attributes:{年龄:'青年'}};
const look:StudioIpAsset={...main,current:false,lookId:'sheet',storageKey:'sheet-key',name:'完整设定',assetRole:'sheet'};
test('one card per person retains the current main and every precise historical or derived reference',()=>{
  const history={...main,current:false,version:1,storageKey:'old',assetRole:'history' as const};const people=groupStudioIpAssets([look,history,main]);
  expect(people).toHaveLength(1);expect(people[0].main).toBe(main);expect(people[0].name).toBe('小紫');expect(people[0].assets).toEqual([look,history,main]);
});
test('search and filters operate on real attributes and asset roles rather than guessing from names',()=>{
  const second={...main,avatarId:'b',name:'真人',characterName:'真人',path:'real' as const,attributes:{}};const groups=groupStudioIpAssets([main,look,second]);
  expect(filterStudioCharacters(groups,'完整','ai','sheet',['年龄','青年']).map(c=>c.id)).toEqual(['a']);
  expect(filterStudioCharacters(groups,'','real','sheet')).toEqual([]);expect(ipAssetRole({...look,assetRole:undefined,name:'三视图'})).toBe('look');
});
