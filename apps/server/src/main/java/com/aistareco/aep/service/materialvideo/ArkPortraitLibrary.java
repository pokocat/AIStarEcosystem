package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;

/** Owner-scoped official portraits. Portrait ingestion and verification do not create video credit reservations. */
@Service
public class ArkPortraitLibrary {
    public static final String REVIEW_CODE="VIDEO_ASSET_NEEDS_REVIEW";
    public static final String REVIEW_MESSAGE="参考人像需要核验，请确认以下素材后继续生成。";
    public static final String VERSION="ark-portrait-v1-20261109";
    public static final String AGREEMENT="本人同意将所选人像素材提交火山引擎方舟，用于活体核验、人脸一致性比对、素材审核和存储，并仅供本人主动发起的视频创作使用。刷脸核验不等同于证件实名或公证。可在本页撤销授权；撤销后停止新增使用，并删除官方素材及素材组。";
    public static final String VIRTUAL_DECLARATION="本人确认拥有素材的合法使用及处分权限，该素材为 AI 生成的虚拟人像，不与任何自然人肖像或形象雷同，不侵害第三方权利。";
    private static final ObjectMapper JSON=new ObjectMapper();
    private final JdbcTemplate db; private final VideoAssetLibraryRecordRepository libraries;
    private final ArkAssetClient api; private final FileStorageService storage; private final IpProjectService projects;
    private final String callbackBase;
    public ArkPortraitLibrary(JdbcTemplate db,VideoAssetLibraryRecordRepository libraries,ArkAssetClient api,
            FileStorageService storage,@Lazy IpProjectService projects,
            @Value("${aep.video-assets.public-api-base:https://api.aibuzz.cn}")String callbackBase) {
        this.db=db;this.libraries=libraries;this.api=api;this.storage=storage;this.projects=projects;
        this.callbackBase=callbackBase.replaceAll("/+$","");
    }
    public record Item(String id,String libraryId,String key,String mediaType,String label,String previewUrl,
                       String status,String placement,String personId,String errorMessage,String updatedAt) {}
    public record Person(String id,String libraryId,String name,String status,String verificationUrl,String expiresAt,String createdAt) {}
    public record Overview(List<Map<String,String>> libraries,List<Item> items,List<Person> persons,Map<String,String> agreement) {}
    private VideoAssetLibraryRecord library(String id) {
        var record=libraries.findById(id).orElseThrow(()->bad("VIDEO_ASSET_LIBRARY_NOT_CONFIGURED","所选模型的素材服务暂不可用，请稍后重试。"));
        requireConfigured(record);return record;
    }
    public void requireConfigured(VideoAssetLibraryRecord record) {
        try {
            JsonNode c=JSON.readTree(record.getConfigJson());
            if(!"ark".equals(record.getAdapter())||c.path("projectName").asText().isBlank()
                    ||c.path("virtualGroupId").asText().isBlank()||record.getCredentialEncrypted()==null)throw new IllegalArgumentException();
        } catch(Exception e){throw bad("VIDEO_ASSET_LIBRARY_NOT_CONFIGURED","所选模型的素材服务暂不可用，请稍后重试。");}
    }
    public Overview overview(String owner) {
        var all=libraries.findAll().stream().filter(x->"ark".equals(x.getAdapter())).map(x->Map.of("id",x.getId(),"name",x.getName())).toList();
        // Provider refresh is explicit POST; a GET remains read-only for phone-unverified guests.
        var items=db.queryForList("SELECT * FROM video_asset_portrait WHERE owner_user_id=? ORDER BY updated_at DESC LIMIT 100",owner).stream().map(this::item).toList();
        var persons=db.queryForList("SELECT * FROM video_asset_person WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 100",owner).stream().map(this::person).toList();
        return new Overview(all,items,persons,Map.of("version",VERSION,"text",AGREEMENT,"virtualDeclaration",VIRTUAL_DECLARATION));
    }
    public boolean isOfficialLibrary(String id){return libraries.findById(id).map(r->"ark".equals(r.getAdapter())).orElse(false);}
    public void requireOwnedKeys(String owner,Collection<String> keys){for(String key:keys)projects.requireOwnedAssetKey(owner,key);}
    public List<Item> itemsFor(String owner,String lib,Collection<String> keys) {
        var result=new ArrayList<Item>();
        for(String key:new LinkedHashSet<>(keys)) {
            var rows=db.queryForList("SELECT * FROM video_asset_portrait WHERE id=? AND owner_user_id=?",hash(owner,lib,key),owner);
            if(!rows.isEmpty())result.add(item(rows.get(0)));
        }
        return result;
    }
    public Item register(String owner,String libraryId,String key,String mediaType,String label) {
        library(libraryId);key=projects.requireOwnedAssetKey(owner,key);
        if(key==null||(mediaType==null||!Set.of("image","video","audio").contains(mediaType)))throw bad("VIDEO_ASSET_INPUT_INVALID","请选择有效的人像素材。");
        String id=hash(owner,libraryId,key);Instant now=Instant.now();
        try {db.update("INSERT INTO video_asset_portrait(id,owner_user_id,library_id,source_key,media_type,label,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'needs_review',?,?)",
                id,owner,libraryId,key,mediaType,limit(label,128),Timestamp.from(now),Timestamp.from(now));}
        catch(DuplicateKeyException existing){ /* Same owner, library and key share one approval. */ }
        return item(ownedItem(owner,id));
    }
    /** Called only after an explicit person-restriction rejection, never after uncertain acceptance. */
    public boolean flag(String owner,String libraryId,VideoGenSpec spec,int status,String response) {
        if(status!=400||VideoProviderErrorMapper.submit(status,response).filter(x->VideoProviderErrorMapper.VIDEO_REFERENCE_PERSON_RESTRICTED.equals(x.code())).isEmpty())return false;
        var keys=new ArrayList<String>();var types=new ArrayList<String>();
        if(spec.firstFrameKey()!=null){keys.add(spec.firstFrameKey());types.add("image");}
        if(spec.lastFrameKey()!=null){keys.add(spec.lastFrameKey());types.add("image");}
        for(var ref:spec.references()){keys.add(ref.key());types.add(ref.mediaType());}
        var indices=new LinkedHashSet<Integer>();var matcher=Pattern.compile("content\\[(\\d+)\\]").matcher(response);
        while(matcher.find()){int i=Integer.parseInt(matcher.group(1))-1;if(i>=0&&i<keys.size())indices.add(i);}
        // If the provider does not identify an index, ask about visual inputs, never silently label them virtual.
        if(indices.isEmpty())for(int i=0;i<keys.size();i++)if(!"audio".equals(types.get(i)))indices.add(i);
        boolean needsReview=false;
        for(int i:indices) {
            var item=register(owner,libraryId,keys.get(i),types.get(i),"参考素材 "+(i+1));
            needsReview|=!"active".equals(item.status());
        }
        // If Ark rejects a trusted reference, reopening an already approved review would retry it in a loop.
        return needsReview;
    }
    /** All undeclared nonportrait inputs retain signed URLs. Known portraits can only use Active references. */
    public String reference(String owner,String libraryId,String key) {
        library(libraryId);
        var rows=db.queryForList("SELECT * FROM video_asset_portrait WHERE id=? AND owner_user_id=?",hash(owner,libraryId,key),owner);
        if(rows.isEmpty())return storage.upstreamFetchUrl(key);
        var r=rows.get(0);
        if(!"active".equals(r.get("status")))throw review();
        String personId=(String)r.get("person_id");
        if(personId!=null&&db.queryForObject("SELECT COUNT(*) FROM video_asset_person WHERE id=? AND owner_user_id=? AND library_id=? AND status='active'",Integer.class,personId,owner,libraryId)!=1)throw review();
        return "asset://"+r.get("asset_id");
    }
    public Item declare(String owner,String id,String kind,String personId,boolean accepted,String version) {
        var r=ownedItem(owner,id);String lib=(String)r.get("library_id");var record=library(lib);
        if(!accepted||!VERSION.equals(version))throw bad("VIDEO_ASSET_DECLARATION_REQUIRED","请阅读并确认人像素材授权说明。");
        if(kind==null||!Set.of("virtual","person").contains(kind))throw bad("VIDEO_ASSET_INPUT_INVALID","请选择人像类型。");
        String group;
        if("person".equals(kind)) {
            var p=ownedPerson(owner,personId);
            if(!lib.equals(p.get("library_id"))||!"active".equals(p.get("status")))throw bad("VIDEO_ASSET_PERSON_REQUIRED","请先完成该人物的本人核验。");
            group=(String)p.get("group_id");
        } else {
            personId=null;try{group=JSON.readTree(record.getConfigJson()).path("virtualGroupId").asText();}catch(Exception e){throw new IllegalStateException(e);}
        }
        // Commit the claim before network IO. Concurrent clicks see the same uploading record.
        int changed=db.update("UPDATE video_asset_portrait SET status='uploading',placement=?,person_id=?,declared_by=?,declared_at=?,declaration_text=?,error_code=NULL,updated_at=? WHERE id=? AND owner_user_id=? AND status IN ('needs_review','failed','revoked')",
                kind,personId,owner,now(),"virtual".equals(kind)?VIRTUAL_DECLARATION:AGREEMENT,now(),id,owner);
        if(changed==0)return item(ownedItem(owner,id));
        try {
            String source=projects.requireOwnedAssetKey(owner,(String)r.get("source_key"));
            // Free tier permits 3 CreateAsset per minute per library; reserve across endpoints and workers.
            if(!reserveUpload(lib))throw bad("VIDEO_ASSET_RATE_LIMITED","素材提交较频繁，请一分钟后重试。");
            String type=switch((String)r.get("media_type")){case "image"->"Image";case "video"->"Video";default->"Audio";};
            var result=api.call(record,"CreateAsset",Map.of("GroupId",group,"URL",storage.upstreamFetchUrl(source),"AssetType",type,"Name",limit((String)r.get("label"),64)));
            String asset=result.path("Id").asText();if(!asset.startsWith("asset-"))throw bad("VIDEO_ASSET_PROVIDER_FAILED","未收到素材入库结果，请稍后重试。");
            // A revoked person must never become usable again when an in-flight upload returns.
            int saved=db.update("UPDATE video_asset_portrait SET asset_id=?,status='processing',updated_at=? WHERE id=? AND status='uploading'",asset,now(),id);
            if(saved==0)api.call(record,"DeleteAsset",Map.of("Id",asset));
        } catch(BusinessException e) {
            db.update("UPDATE video_asset_portrait SET status='failed',error_code=?,updated_at=? WHERE id=? AND status='uploading'",e.getCode(),now(),id);throw e;
        }
        return item(ownedItem(owner,id));
    }
    private boolean reserveUpload(String lib) {
        // DB row lock and timestamp update in a single statement: one ingest per 21 seconds, conservatively below Entry QPM.
        return db.update("UPDATE video_asset_library SET updated_at=? WHERE id=? AND updated_at<?",now(),lib,Timestamp.from(Instant.now().minusSeconds(21)))==1;
    }
    public Item refreshItem(String owner,String id) {
        var r=ownedItem(owner,id);
        if(!"processing".equals(r.get("status")))return item(r);
        String asset=(String)r.get("asset_id");var record=library((String)r.get("library_id"));
        JsonNode result;
        try{result=api.call(record,"GetAsset",Map.of("Id",asset));}
        catch(BusinessException e){if(!"VIDEO_ASSET_REMOTE_NOT_FOUND".equals(e.getCode()))throw e;
            db.update("UPDATE video_asset_portrait SET status='failed',error_code='VIDEO_ASSET_REMOTE_NOT_FOUND',updated_at=? WHERE id=? AND status='processing'",now(),id);return item(ownedItem(owner,id));}
        String state=result.path("Status").asText();
        if("Active".equals(state)||"Failed".equals(state)) {
            if("Failed".equals(state))org.slf4j.LoggerFactory.getLogger(getClass()).warn("[ark-assets] asset={} review={}",asset,ArkAssetClient.safe(result));
            db.update("UPDATE video_asset_portrait SET status=?,error_code=?,updated_at=? WHERE id=? AND status='processing'",
                    "Active".equals(state)?"active":"failed",result.path("Error").path("Code").asText(null),now(),id);
        } else if(((Timestamp)r.get("updated_at")).toInstant().isBefore(Instant.now().minusSeconds(1800))) {
            db.update("UPDATE video_asset_portrait SET status='failed',error_code='VIDEO_ASSET_REVIEW_TIMEOUT',updated_at=? WHERE id=? AND status='processing'",now(),id);
        }
        return item(ownedItem(owner,id));
    }
    public Person startPerson(String owner,String lib,String name,String requestId,boolean accepted,String version) {
        var record=library(lib);
        if(!accepted||!VERSION.equals(version))throw bad("VIDEO_ASSET_DECLARATION_REQUIRED","请阅读并同意本人核验授权说明。");
        if(name==null||name.isBlank()||name.length()>64||requestId==null||!requestId.matches("[a-zA-Z0-9-]{16,64}"))throw bad("VIDEO_ASSET_INPUT_INVALID","请填写人物名称后重试。");
        String id=hash(owner,lib,requestId);var existing=db.queryForList("SELECT * FROM video_asset_person WHERE id=? AND owner_user_id=?",id,owner);
        if(!existing.isEmpty())return person(existing.get(0));
        String state=UUID.randomUUID().toString()+UUID.randomUUID();Instant now=Instant.now();
        try{db.update("INSERT INTO video_asset_person(id,owner_user_id,library_id,name,status,callback_hash,agreement_version,agreement_text,expires_at,created_at,updated_at) VALUES(?,?,?,?,'verifying',?,?,?,?,?,?)",
                id,owner,lib,name,hash(state),VERSION,AGREEMENT,Timestamp.from(now.plusSeconds(1800)),Timestamp.from(now),Timestamp.from(now));}
        catch(DuplicateKeyException race){return person(ownedPerson(owner,id));}
        try {
            var result=api.call(record,"CreateVisualValidateSession",Map.of("CallbackURL",callbackBase+"/api/v1/asset-library/callback?state="+state));
            String token=result.path("BytedToken").asText(),link=result.path("H5Link").asText();
            if(token.isBlank()||!link.startsWith("https://"))throw bad("VIDEO_ASSET_PROVIDER_FAILED","未能打开本人核验，请重试。");
            db.update("UPDATE video_asset_person SET token_encrypted=?,link_encrypted=?,updated_at=? WHERE id=? AND status='verifying'",AepCryptoUtil.encrypt(token),AepCryptoUtil.encrypt(link),now(),id);
        }catch(BusinessException e){db.update("UPDATE video_asset_person SET status='failed',updated_at=? WHERE id=? AND status='verifying'",now(),id);throw e;}
        return person(ownedPerson(owner,id));
    }
    public void callback(String state) {
        if(state==null||state.length()>128)throw bad("VIDEO_ASSET_CALLBACK_INVALID","核验链接无效，请重新开始核验。");
        var rows=db.queryForList("SELECT * FROM video_asset_person WHERE callback_hash=?",hash(state));
        if(rows.isEmpty())throw bad("VIDEO_ASSET_CALLBACK_INVALID","核验链接无效，请重新开始核验。");
        finishPerson(rows.get(0));
    }
    public Person refreshPerson(String owner,String id){var p=ownedPerson(owner,id);finishPerson(p);return person(ownedPerson(owner,id));}
    private void finishPerson(Map<String,Object> p) {
        boolean revoked="revoked".equals(p.get("status"));
        if(!"verifying".equals(p.get("status"))&&!revoked)return;
        String id=(String)p.get("id");
        if(((Timestamp)p.get("expires_at")).toInstant().isBefore(Instant.now())) {
            db.update("UPDATE video_asset_person SET status=?,token_encrypted=NULL,link_encrypted=NULL,updated_at=? WHERE id=? AND status IN ('verifying','revoked')",revoked?"revoked":"failed",now(),id);return;
        }
        if(p.get("token_encrypted")==null)return;
        var result=api.call(library((String)p.get("library_id")),"GetVisualValidateResult",Map.of("BytedToken",AepCryptoUtil.decrypt((String)p.get("token_encrypted"))));
        String group=result.path("GroupId").asText();
        if(group.startsWith("group-")) {
            int saved=revoked?0:db.update("UPDATE video_asset_person SET group_id=?,status='active',token_encrypted=NULL,link_encrypted=NULL,updated_at=? WHERE id=? AND status='verifying'",group,now(),id);
            if(saved==0) {
                deleteGroup(library((String)p.get("library_id")),group);
                db.update("UPDATE video_asset_person SET token_encrypted=NULL,link_encrypted=NULL,updated_at=? WHERE id=? AND status='revoked'",now(),id);
            }
        }
    }
    public void revoke(String owner,String id) {
        var p=ownedPerson(owner,id);String lib=(String)p.get("library_id");var record=library(lib);
        // Local revocation takes effect first; failed provider deletion can be retried from this same record.
        db.update("UPDATE video_asset_person SET status='revoked',link_encrypted=NULL,updated_at=? WHERE id=? AND owner_user_id=?",now(),id,owner);
        db.update("UPDATE video_asset_portrait SET status='revoked',updated_at=? WHERE person_id=? AND owner_user_id=?",now(),id,owner);
        if(p.get("group_id")!=null) {
            deleteGroup(record,(String)p.get("group_id"));
            db.update("UPDATE video_asset_person SET group_id=NULL,token_encrypted=NULL WHERE id=? AND status='revoked'",id);
        }
    }
    private void deleteGroup(VideoAssetLibraryRecord record,String group) {
        try{api.call(record,"DeleteAssetGroup",Map.of("Id",group));}
        catch(BusinessException e){if(!"VIDEO_ASSET_REMOTE_NOT_FOUND".equals(e.getCode()))throw e;}
    }
    public void forget(String owner,String lib,Collection<String> keys) {
        for(String key:keys)db.update("UPDATE video_asset_portrait SET status='failed',error_code='VIDEO_ASSET_REMOTE_NOT_FOUND',updated_at=? WHERE id=? AND owner_user_id=? AND status='active'",now(),hash(owner,lib,key),owner);
    }
    private Map<String,Object> ownedItem(String owner,String id){return owned("video_asset_portrait",owner,id);}
    private Map<String,Object> ownedPerson(String owner,String id){return owned("video_asset_person",owner,id);}
    private Map<String,Object> owned(String table,String owner,String id) {
        var rows=db.queryForList("SELECT * FROM "+table+" WHERE id=? AND owner_user_id=?",id,owner);
        if(rows.isEmpty())throw BusinessException.notFound("VIDEO_ASSET_NOT_FOUND","未找到该人像记录，请刷新后重试。");return rows.get(0);
    }
    private Item item(Map<String,Object> r) {
        String code=(String)r.get("error_code");String error=code==null?null:switch(code){
            case "FaceMismatch"->"素材中的人脸与完成核验的本人不一致，请更换清晰的本人照片。";
            case "ContentRestricted","InputImageSensitiveContentDetected","InputImageSensitiveContentDetected.PrivacyInformation"->"素材未通过审核；真人照片请完成本人核验后提交，虚拟人像请更换素材。";
            case "VIDEO_ASSET_REVIEW_TIMEOUT"->"素材审核超时，请稍后重新提交。";
            case "VIDEO_ASSET_REMOTE_NOT_FOUND"->"官方素材引用已失效，请重新提交入库。";
            default->"素材暂未完成入库，请检查素材后重试。";};
        return new Item((String)r.get("id"),(String)r.get("library_id"),(String)r.get("source_key"),(String)r.get("media_type"),(String)r.get("label"),
                "image".equals(r.get("media_type"))?storage.signedUrl((String)r.get("source_key")):null,(String)r.get("status"),(String)r.get("placement"),(String)r.get("person_id"),error,iso(r,"updated_at"));
    }
    private Person person(Map<String,Object> r) {
        boolean live="verifying".equals(r.get("status"))&&((Timestamp)r.get("expires_at")).toInstant().isAfter(Instant.now());
        return new Person((String)r.get("id"),(String)r.get("library_id"),(String)r.get("name"),"verifying".equals(r.get("status"))&&!live?"failed":(String)r.get("status"),
                live?AepCryptoUtil.decrypt((String)r.get("link_encrypted")):null,iso(r,"expires_at"),iso(r,"created_at"));
    }
    private static String iso(Map<String,Object> r,String key){return ((Timestamp)r.get(key)).toInstant().toString();}
    private static Timestamp now(){return Timestamp.from(Instant.now());}
    private static String limit(String s,int n){return s==null||s.isBlank()?"人像素材":s.substring(0,Math.min(n,s.length()));}
    static BusinessException review(){return new BusinessException(HttpStatus.CONFLICT,REVIEW_CODE,REVIEW_MESSAGE);}
    private static BusinessException bad(String code,String message){return BusinessException.badRequest(code,message);}
    static String hash(String...parts){try{var digest=MessageDigest.getInstance("SHA-256");for(String s:parts)digest.update((s.length()+":"+s).getBytes(StandardCharsets.UTF_8));return HexFormat.of().formatHex(digest.digest());}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}
