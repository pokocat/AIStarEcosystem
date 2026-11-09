package com.aistareco.aep.service.materialvideo;

import java.util.*;

/** Official account adapter. All Ark reference/approval differences remain behind the common library interface. */
final class ArkAssetLibrary implements VideoAssetLibrary {
    private final String id;private final ArkPortraitLibrary portraits;
    ArkAssetLibrary(VideoAssetLibraryRecord record,ArkPortraitLibrary portraits){portraits.requireConfigured(record);this.id=record.getId();this.portraits=portraits;}
    @Override public Optional<String> preparedReference(String owner,String key){return Optional.of(portraits.reference(owner,id,key));}
    @Override public boolean preparesLegacyInputs(){return true;}
    @Override public boolean flagReview(String owner,VideoGenSpec spec,int status,String response){return portraits.flag(owner,id,spec,status,response);}
    @Override public boolean forgetReferences(String owner,Collection<String> keys){portraits.forget(owner,id,keys);return true;}
    @Override public MaterialVideoInputAssets.Receipt submit(EndpointAccess access,LibraryFile file){throw ArkPortraitLibrary.review();}
    @Override public boolean rejectedStaleReference(int status,String response){
        return status==400&&response!=null&&response.toLowerCase(Locale.ROOT).matches("(?s).*(assetnotfound|asset.*not.found|invalidasset).*");
    }
}
