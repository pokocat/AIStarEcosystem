import type { StudioIpAsset,StudioIpAssetRole } from '@ai-star-eco/types/ip-studio-workflow';

export const ipAssetRoles:Record<StudioIpAssetRole,string>={main:'主形象',history:'历史版本',sheet:'人物设定图',portrait:'脸部特写','three-view':'三视图',front:'正面',side:'侧面',back:'背面',expression:'表情',detail:'细节',look:'造型'};
export const editableIpAssetRoles:StudioIpAssetRole[]=(Object.keys(ipAssetRoles) as StudioIpAssetRole[]).filter(r=>r!=='main'&&r!=='history');
export const ipAssetIdentity=(asset:StudioIpAsset)=>asset.lookId||`${asset.avatarId}:${asset.version}:${asset.storageKey}`;
export const ipAssetRole=(asset:StudioIpAsset):StudioIpAssetRole=>asset.current?'main':asset.assetRole&&asset.assetRole in ipAssetRoles?asset.assetRole:asset.lookId?'look':'history';
export interface StudioLibraryCharacter {id:string;name:string;main:StudioIpAsset;assets:StudioIpAsset[]}
/** A person is the browsing unit; importing still selects one exact asset/version/look. */
export function groupStudioIpAssets(assets:StudioIpAsset[]):StudioLibraryCharacter[] {
  const groups=new Map<string,StudioIpAsset[]>();
  for(const asset of assets)groups.set(asset.avatarId,[...(groups.get(asset.avatarId)||[]),asset]);
  return [...groups].map(([id,items])=>{const main=items.find(a=>a.current&&!a.lookId)||items.find(a=>!a.lookId)||items[0];return {id,name:main.characterName||main.name,main,assets:items};});
}
export function filterStudioCharacters(characters:StudioLibraryCharacter[],search:string,path:string,role:string,attribute?:[string,string]) {
  const query=search.trim().toLocaleLowerCase();
  return characters.filter(c=>(path==='all'||c.main.path===path)&&(!role||role==='all'||c.assets.some(a=>ipAssetRole(a)===role))&&
    (!attribute||c.main.attributes?.[attribute[0]]===attribute[1])&&(!query||[c.name,c.main.description,...Object.values(c.main.attributes||{}),...c.assets.map(a=>a.name)].join(' ').toLocaleLowerCase().includes(query)));
}
