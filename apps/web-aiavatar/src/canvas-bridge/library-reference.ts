import type { LibraryObject, IpSavedAsset } from '@ai-star-eco/types';
import { mainLibraryVersion } from './asset-library';
/** A canvas receives a snapshot. Changes to an asset's main image never mutate this reference. */
export function libraryObjectAsset(object:LibraryObject,folderName:string='未分类',versionId?:string):IpSavedAsset {
  const version=versionId?object.versions.find(v=>v.id===versionId):mainLibraryVersion(object);
  const base={id:object.id,title:object.name,coverUrl:version?.url||'',tags:[],createdAt:object.createdAt,updatedAt:object.updatedAt,source:object.sources[0]?.title||'资产库创建',
    metadata:{libraryReference:{objectId:object.id,versionId:version?.id,name:object.name,description:object.description,folderName,sourceTitle:object.sources[0]?.title||'资产库创建'}}};
  return version?{...base,kind:'image',data:{dataUrl:version.url,storageKey:version.storageKey,width:0,height:0,bytes:0,mimeType:'image/png'}}:
    {...base,kind:'text',data:{content:`${object.name}\n${object.description}\n尚无参考图，仅引用文字设定。`}};
}
