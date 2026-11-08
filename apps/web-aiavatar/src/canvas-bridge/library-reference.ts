import type { LibraryObject, IpSavedAsset } from '@ai-star-eco/types';
import type { StudioIpAsset } from '@ai-star-eco/types/ip-studio-workflow';
import { mainLibraryVersion } from './asset-library';
import { ipAssetIdentity, ipAssetRole, ipAssetRoles } from './studio-ip-library';
/** A canvas receives a snapshot. Changes to an asset's main image never mutate this reference. */
export function libraryObjectAsset(object:LibraryObject,folderName:string='未分类',versionId?:string):IpSavedAsset {
  const version=versionId?object.versions.find(v=>v.id===versionId):mainLibraryVersion(object);
  const base={id:object.id,title:object.name,coverUrl:version?.url||'',tags:[],createdAt:object.createdAt,updatedAt:object.updatedAt,source:object.sources[0]?.title||'资产库创建',
    metadata:{libraryReference:{objectId:object.id,versionId:version?.id,name:object.name,description:object.description,folderName,sourceTitle:object.sources[0]?.title||'资产库创建'}}};
  return version?{...base,kind:'image',data:{dataUrl:version.url,storageKey:version.storageKey,width:0,height:0,bytes:0,mimeType:'image/png'}}:
    {...base,kind:'text',data:{content:`${object.name}\n${object.description}\n尚无参考图，仅引用文字设定。`}};
}

/** IP 主形象、历史版本和衍生视角按实际图片引用，不自动建角色卡或切换主形象。 */
export function studioIpAssetReference(asset: StudioIpAsset): IpSavedAsset {
  const role = ipAssetRoles[ipAssetRole(asset)];
  const title = `${asset.characterName || asset.name} · ${asset.lookId ? asset.name : role + (asset.current ? '' : ` v${asset.version}`)}`;
  return { id: `ip:${asset.avatarId}:${ipAssetIdentity(asset)}`, kind: 'image', title, coverUrl: asset.url, tags: [], source: '我的 IP', createdAt: '', updatedAt: '',
    metadata: { ipReference: { avatarId: asset.avatarId, version: asset.version, lookId: asset.lookId, storageKey: asset.storageKey }, assetRole: role },
    data: { dataUrl: asset.url, storageKey: asset.storageKey, width: 0, height: 0, bytes: 0, mimeType: 'image/png' } };
}
