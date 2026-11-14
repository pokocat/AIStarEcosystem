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
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
    /** Platform-owned approvals for free official avatar reference sheets. */
    static final String OFFICIAL_AVATAR_OWNER = "system:studio-official-avatars";
    private static final Logger log = LoggerFactory.getLogger(ArkPortraitLibrary.class);
    private static final String SUBMISSION_UNKNOWN = ArkAssetClient.SUBMISSION_UNKNOWN;
    private static final ObjectMapper JSON=new ObjectMapper();
    private final JdbcTemplate db; private final VideoAssetLibraryRecordRepository libraries;
    private final ArkAssetClient api; private final FileStorageService storage; private final IpProjectService projects;
    private final String callbackBase;
    private final TransactionTemplate transactions;
    public ArkPortraitLibrary(JdbcTemplate db,VideoAssetLibraryRecordRepository libraries,ArkAssetClient api,
            FileStorageService storage,@Lazy IpProjectService projects, PlatformTransactionManager transactionManager,
            @Value("${aep.video-assets.public-api-base:https://api.aibuzz.cn}")String callbackBase) {
        this.db=db;this.libraries=libraries;this.api=api;this.storage=storage;this.projects=projects;
        this.callbackBase=callbackBase.replaceAll("/+$","");
        this.transactions = new TransactionTemplate(transactionManager);
    }
    public record Item(String id,String libraryId,String key,String mediaType,String label,String previewUrl,
                       String status,String placement,String personId,String errorMessage,String updatedAt,boolean submissionUnknown,
                       String arkError) {}
    public record Person(String id,String libraryId,String name,String status,String verificationUrl,String expiresAt,String createdAt,
                         String arkError) {}
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
    /** 资产页给图片打「已进素材库」标记用：本人已通过审核的人像图片。只读本地记录，不查供应商。 */
    public record Verified(String key,String placement) {}
    public List<Verified> verified(String owner) {
        var seen=new LinkedHashMap<String,String>();
        for(var r:db.queryForList("SELECT source_key,placement FROM video_asset_portrait WHERE owner_user_id=? AND status='active' AND media_type='image' ORDER BY updated_at DESC LIMIT 2000",owner)){
            String key=(String)r.get("source_key"),placement=(String)r.get("placement");
            // 同一张图在两个库里都通过时，本人核验比虚拟审核说得更具体。
            if(key!=null&&(!seen.containsKey(key)||"person".equals(placement)))seen.put(key,"person".equals(placement)?"person":"virtual");
        }
        return seen.entrySet().stream().map(e->new Verified(e.getKey(),e.getValue())).toList();
    }
    /** 真人复刻登记授权用：本人名下本人核验已通过（有官方真人组）的人物。不查供应商，只认服务端已确认的结果。 */
    public Person requireVerifiedPerson(String owner,String id) {
        var rows=id==null||id.isBlank()?List.<Map<String,Object>>of():db.queryForList("SELECT * FROM video_asset_person WHERE id=? AND owner_user_id=?",id,owner);
        if(rows.isEmpty()||!"active".equals(rows.get(0).get("status"))||rows.get(0).get("group_id")==null)
            throw new BusinessException(HttpStatus.CONFLICT,"DAP_PERSON_NOT_VERIFIED","请先完成本人核验。");
        return person(rows.get(0));
    }
    public boolean isOfficialLibrary(String id){return libraries.findById(id).map(r->"ark".equals(r.getAdapter())).orElse(false);}
    public void requireOwnedKeys(String owner,Collection<String> keys){for(String key:keys)projects.requireOwnedAssetKey(owner,key);}
    public List<Item> itemsFor(String owner,String lib,Collection<String> keys) {
        var result=new ArrayList<Item>();
        for(String key:new LinkedHashSet<>(keys)) {
            var official = approvedOfficialAvatar(lib, key);
            if (official.isPresent()) {
                result.add(item(official.get()));
                continue;
            }
            var rows=db.queryForList("SELECT * FROM video_asset_portrait WHERE id=? AND owner_user_id=?",hash(owner,lib,key),owner);
            if(!rows.isEmpty())result.add(item(rows.get(0)));
        }
        return result;
    }

    private Optional<Map<String, Object>> approvedOfficialAvatar(String libraryId, String key) {
        if (!key.startsWith("dap_plaza/platform/")) return Optional.empty();
        return db.queryForList("""
            SELECT p.* FROM video_asset_portrait p
            WHERE p.id=? AND p.owner_user_id=? AND p.library_id=? AND p.source_key=?
                AND p.status='active' AND p.placement='virtual' AND p.media_type='image'
                AND p.person_id IS NULL AND p.asset_id LIKE 'asset-%'
                AND EXISTS (SELECT 1 FROM dap_public_avatar a WHERE a.three_view_key=p.source_key
                    AND a.created_by_user_id='platform' AND a.access='free' AND a.id NOT IN ('PA-07','PA-08','PA-09'))
            """, hash(OFFICIAL_AVATAR_OWNER, libraryId, key), OFFICIAL_AVATAR_OWNER, libraryId, key)
                .stream().findFirst();
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
        String official = referenceError(response);
        boolean needsReview=false;
        for(int i:indices) {
            if (approvedOfficialAvatar(libraryId, keys.get(i)).isPresent()) continue;
            var item=register(owner,libraryId,keys.get(i),types.get(i),"参考素材 "+(i+1));
            if (official != null && "needs_review".equals(item.status())) {
                db.update("""
                    UPDATE video_asset_portrait SET ark_error=? WHERE id=? AND owner_user_id=? AND status='needs_review'
                    """, official, item.id(), owner);
            }
            needsReview|=!"active".equals(item.status());
        }
        // If Ark rejects a trusted reference, reopening an already approved review would retry it in a loop.
        return needsReview;
    }
    private String referenceError(String response) {
        try {
            return ArkAssetClient.officialError(JSON.readTree(response).path("error"));
        } catch (com.fasterxml.jackson.core.JsonProcessingException invalid) {
            return null;
        }
    }
    /** All undeclared nonportrait inputs retain signed URLs. Known portraits can only use Active references. */
    public String reference(String owner,String libraryId,String key) {
        library(libraryId);
        var official = approvedOfficialAvatar(libraryId, key);
        if (official.isPresent()) return "asset://" + official.get().get("asset_id");
        var rows=db.queryForList("SELECT * FROM video_asset_portrait WHERE id=? AND owner_user_id=?",hash(owner,libraryId,key),owner);
        if(rows.isEmpty())return storage.upstreamFetchUrl(key);
        var r=rows.get(0);
        if(!"active".equals(r.get("status")))throw review();
        String personId=(String)r.get("person_id");
        if(personId!=null&&db.queryForObject("SELECT COUNT(*) FROM video_asset_person WHERE id=? AND owner_user_id=? AND library_id=? AND status='active'",Integer.class,personId,owner,libraryId)!=1)throw review();
        return "asset://"+r.get("asset_id");
    }
    public Item declare(String owner, String id, String kind, String personId, boolean accepted, String version) {
        return declareBatch(owner, List.of(id), kind, personId, accepted, version).get(0);
    }

    public List<Item> declareBatch(String owner, List<String> ids, String kind, String personId, boolean accepted, String version) {
        if (!accepted || !VERSION.equals(version))
            throw bad("VIDEO_ASSET_DECLARATION_REQUIRED", "请阅读并确认人像素材授权说明。");
        if (kind == null || !Set.of("virtual", "person").contains(kind))
            throw bad("VIDEO_ASSET_INPUT_INVALID", "请选择人像类型。");
        if (ids == null || ids.isEmpty() || ids.size() > 12 || ids.stream().anyMatch(id -> id == null || id.isBlank()))
            throw bad("VIDEO_ASSET_INPUT_INVALID", "请选择 1 至 12 项人像素材。");

        var unique = new LinkedHashSet<>(ids);
        String person = "person".equals(kind) ? personId : null;
        return transactions.execute(tx -> {
            var rows = unique.stream().map(id -> ownedItem(owner, id)).toList();
            String lib = (String) rows.get(0).get("library_id");
            if (rows.stream().anyMatch(row -> !lib.equals(row.get("library_id"))))
                throw bad("VIDEO_ASSET_INPUT_INVALID", "请选择同一素材库中的人像。");
            library(lib);
            if ("person".equals(kind)) requireVerifiedGroup(owner, lib, person, true);
            for (var row : rows) projects.requireOwnedAssetKey(owner, (String) row.get("source_key"));

            var submittedAt = now();
            // Lock shared photos in the same order even if two batches list them differently.
            for (String id : unique.stream().sorted().toList()) {
                db.update("""
                    UPDATE video_asset_portrait SET status='queued', placement=?, person_id=?, declared_by=?,
                        declared_at=?, declaration_text=?, asset_id=NULL, error_code=NULL, ark_error=NULL, review_after=NULL, updated_at=?
                    WHERE id=? AND owner_user_id=? AND status IN ('needs_review','failed','revoked')
                        AND (error_code IS NULL OR error_code<>?)
                    """, kind, person, owner, submittedAt, "virtual".equals(kind) ? VIRTUAL_DECLARATION : AGREEMENT,
                        submittedAt, id, owner, SUBMISSION_UNKNOWN);
            }
            return unique.stream().map(id -> item(ownedItem(owner, id))).toList();
        });
    }

    private String requireVerifiedGroup(String owner, String lib, String personId, boolean lock) {
        if (personId != null) {
            var rows = db.queryForList("""
                SELECT group_id FROM video_asset_person
                WHERE id=? AND owner_user_id=? AND library_id=? AND status='active'
                """ + (lock ? " FOR UPDATE" : ""), personId, owner, lib);
            if (!rows.isEmpty() && rows.get(0).get("group_id") instanceof String group) return group;
        }
        throw bad("VIDEO_ASSET_PERSON_REQUIRED", "请先完成该人物的本人核验。");
    }

    @Scheduled(fixedDelay = 2_000, scheduler = "portraitAssetScheduler")
    public void dispatchQueued() {
        db.update("""
            UPDATE video_asset_portrait SET status='failed',error_code=?,updated_at=?
            WHERE status='uploading' AND updated_at<?
            """, SUBMISSION_UNKNOWN, now(), Timestamp.from(Instant.now().minusSeconds(120)));
        var readyLibraries = db.queryForList("""
            SELECT l.id FROM video_asset_library l
            WHERE l.adapter='ark' AND (l.portrait_upload_after IS NULL OR l.portrait_upload_after<=?)
                AND EXISTS (SELECT 1 FROM video_asset_portrait p WHERE p.library_id=l.id AND p.status='queued')
            """, String.class, now());
        for (String lib : readyLibraries) {
            var claimed = transactions.execute(tx -> claimNext(lib));
            if (claimed != null) upload(claimed);
        }
    }

    private Map<String,Object> claimNext(String lib) {
        // Serialize selection and quota reservation for the shared library across worker instances.
        var libraries = db.queryForList("SELECT portrait_upload_after FROM video_asset_library WHERE id=? FOR UPDATE", lib);
        if (libraries.isEmpty()) return null;
        Instant now = Instant.now();
        if (libraries.get(0).get("portrait_upload_after") instanceof Timestamp after && after.toInstant().isAfter(now)) return null;

        var rows = db.queryForList("""
            SELECT * FROM video_asset_portrait WHERE library_id=? AND status='queued'
            ORDER BY declared_at, id LIMIT 1 FOR UPDATE
            """, lib);
        if (rows.isEmpty()) return null;

        var row = rows.get(0);
        db.update("UPDATE video_asset_portrait SET status='uploading',updated_at=? WHERE id=?", Timestamp.from(now), row.get("id"));
        // Spread the Entry allowance of three submissions per minute across the minute.
        db.update("UPDATE video_asset_library SET portrait_upload_after=? WHERE id=?", Timestamp.from(now.plusSeconds(21)), lib);
        return row;
    }

    private void upload(Map<String,Object> row) {
        String id = (String) row.get("id");
        String lib = (String) row.get("library_id");
        String owner = (String) row.get("owner_user_id");
        var declaredAt = (Timestamp) row.get("declared_at");
        try {
            var record = library(lib);
            String group = "person".equals(row.get("placement"))
                    ? requireVerifiedGroup(owner, lib, (String) row.get("person_id"), false)
                    : JSON.readTree(record.getConfigJson()).path("virtualGroupId").asText();
            String source = projects.requireOwnedAssetKey(owner, (String) row.get("source_key"));
            String type = switch ((String) row.get("media_type")) {
                case "image" -> "Image";
                case "video" -> "Video";
                default -> "Audio";
            };
            var result = api.call(record, "CreateAsset", Map.of("GroupId", group, "URL", storage.upstreamFetchUrl(source),
                    "AssetType", type, "Name", limit((String) row.get("label"), 64)));
            String asset = result.path("Id").asText();
            if (!asset.startsWith("asset-")) throw bad(SUBMISSION_UNKNOWN, "素材提交结果待确认。");

            int saved = db.update("""
                UPDATE video_asset_portrait SET asset_id=?,status='processing',ark_error=NULL,review_after=?,updated_at=?
                WHERE id=? AND status='uploading' AND declared_at=?
                """, asset, Timestamp.from(Instant.now().plusSeconds(5)), now(), id, declaredAt);
            if (saved == 0) api.call(record, "DeleteAsset", Map.of("Id", asset));
        } catch (BusinessException e) {
            String official = ArkAssetClient.officialError(e);
            if (ArkAssetClient.RATE_LIMITED.equals(e.getCode())) {
                transactions.executeWithoutResult(tx -> {
                    var retryAfter = Timestamp.from(Instant.now().plusSeconds(60));
                    db.update("UPDATE video_asset_library SET portrait_upload_after=? WHERE id=? AND portrait_upload_after<?",
                            retryAfter, lib, retryAfter);
                    db.update("""
                        UPDATE video_asset_portrait SET status='queued',ark_error=?,updated_at=?
                        WHERE id=? AND status='uploading' AND declared_at=?
                        """, official, now(), id, declaredAt);
                });
            } else {
                failUpload(id, declaredAt, e.getCode(), official);
            }
        } catch (Exception e) {
            log.warn("[ark-assets] portrait={} submission could not be recorded ({})", id, e.getClass().getSimpleName());
            failUpload(id, declaredAt, SUBMISSION_UNKNOWN, null);
        }
    }

    private void failUpload(String id, Timestamp declaredAt, String code, String official) {
        db.update("""
            UPDATE video_asset_portrait SET status='failed',error_code=?,ark_error=?,updated_at=?
            WHERE id=? AND status='uploading' AND declared_at=?
            """, code, official, now(), id, declaredAt);
    }

    @Scheduled(fixedDelay = 5_000, scheduler = "portraitAssetScheduler")
    public void pollReviews() {
        var due = db.queryForList("""
            SELECT * FROM video_asset_portrait WHERE status='processing' AND (review_after IS NULL OR review_after<=?)
            ORDER BY updated_at, id LIMIT 16
            """, now());
        for (var row : due) {
            try {
                refreshReview(row);
            } catch (BusinessException e) {
                log.debug("[ark-assets] portrait={} review deferred: {}", row.get("id"), e.getCode());
            }
        }
    }

    public Item refreshItem(String owner, String id) {
        refreshReview(ownedItem(owner, id));
        return item(ownedItem(owner, id));
    }

    private void refreshReview(Map<String,Object> row) {
        if (!"processing".equals(row.get("status"))) return;
        String id = (String) row.get("id");
        String asset = (String) row.get("asset_id");
        var nextCheck = Timestamp.from(Instant.now().plusSeconds(10));
        int claimed = db.update("""
            UPDATE video_asset_portrait SET review_after=? WHERE id=? AND status='processing' AND asset_id=?
                AND (review_after IS NULL OR review_after<=?)
            """, nextCheck, id, asset, now());
        if (claimed == 0) return;

        try {
            var record = library((String) row.get("library_id"));
            var result = api.call(record, "GetAsset", Map.of("Id", asset));
            String state = result.path("Status").asText();
            if ("Active".equals(state)) {
                finishReview(id, asset, "active", null, null);
                return;
            }
            if ("Failed".equals(state)) {
                String[] credentials = ArkAssetClient.assetCredentials(record);
                log.warn("[ark-assets] asset={} review={}", asset, ArkAssetClient.safe(result, credentials));
                String official = ArkAssetClient.officialError(result.path("Error"), credentials);
                finishReview(id, asset, "failed", null, official == null ? "【火山引擎】Failed" : official);
                return;
            }
            String official = result.hasNonNull("Error")
                    ? ArkAssetClient.officialError(result.path("Error"), ArkAssetClient.assetCredentials(record)) : null;
            if (reviewExpired(row)) finishReview(id, asset, "failed", "VIDEO_ASSET_REVIEW_TIMEOUT", official);
            else if (official != null || row.get("ark_error") != null) saveReviewError(id, asset, nextCheck, official);
        } catch (BusinessException e) {
            String official = ArkAssetClient.officialError(e);
            if (ArkAssetClient.NOT_FOUND.equals(e.getCode())) {
                finishReview(id, asset, "failed", e.getCode(), official);
                return;
            }
            if (!reviewExpired(row)) {
                if (official == null) throw e;
                saveReviewError(id, asset, nextCheck, official);
                return;
            }
            finishReview(id, asset, "failed", "VIDEO_ASSET_REVIEW_TIMEOUT", official);
            return;
        }
    }

    private boolean reviewExpired(Map<String,Object> row) {
        return ((Timestamp) row.get("updated_at")).toInstant().isBefore(Instant.now().minusSeconds(1800));
    }

    private void saveReviewError(String id, String asset, Timestamp nextCheck, String official) {
        db.update("""
            UPDATE video_asset_portrait SET ark_error=? WHERE id=? AND status='processing' AND asset_id=? AND review_after=?
            """, official, id, asset, nextCheck);
    }

    private void finishReview(String id, String asset, String status, String code, String official) {
        db.update("""
            UPDATE video_asset_portrait SET status=?,error_code=?,ark_error=?,review_after=NULL,updated_at=?
            WHERE id=? AND status='processing' AND asset_id=?
            """, status, code, official, now(), id, asset);
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
        }catch(BusinessException e){
            db.update("UPDATE video_asset_person SET status='failed',ark_error=?,updated_at=? WHERE id=? AND status='verifying'",
                    ArkAssetClient.officialError(e),now(),id);
            throw e;
        }
        return person(ownedPerson(owner,id));
    }
    public void callback(String state, String bytedToken, String resultCode, String algorithmBaseRespCode) {
        if(state==null||state.length()>128)throw bad("VIDEO_ASSET_CALLBACK_INVALID","核验链接无效，请重新开始核验。");
        var rows=db.queryForList("SELECT * FROM video_asset_person WHERE callback_hash=?",hash(state));
        if(rows.isEmpty())throw bad("VIDEO_ASSET_CALLBACK_INVALID","核验链接无效，请重新开始核验。");
        var row=rows.get(0);
        // Callback codes are diagnostic only. An official GroupId is still required for approval.
        if ("verifying".equals(row.get("status"))
                && row.get("token_encrypted") instanceof String encrypted
                && (bytedToken == null || bytedToken.isEmpty() || bytedToken.length() <= 256
                    && MessageDigest.isEqual(bytedToken.getBytes(StandardCharsets.UTF_8),
                            AepCryptoUtil.decrypt(encrypted).getBytes(StandardCharsets.UTF_8)))
                && resultCode != null && resultCode.matches("[0-9]{1,12}") && !"10000".equals(resultCode)) {
            String official = "【火山引擎】resultCode=" + resultCode;
            if (algorithmBaseRespCode != null && algorithmBaseRespCode.matches("-?[0-9]{1,12}"))
                official += " algorithmBaseRespCode=" + algorithmBaseRespCode;
            savePersonError((String) row.get("id"), official);
            return;
        }
        try {
            finishPerson(row);
        } catch (BusinessException e) {
            // Return the browser to the owner's verification page, which reads the saved official error.
            if (ArkAssetClient.officialError(e) == null || !"verifying".equals(row.get("status"))) throw e;
        }
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
        JsonNode result;
        try {
            result=api.call(library((String)p.get("library_id")),"GetVisualValidateResult",Map.of("BytedToken",AepCryptoUtil.decrypt((String)p.get("token_encrypted"))));
        } catch (BusinessException e) {
            String official = ArkAssetClient.officialError(e);
            if (official != null && !revoked) savePersonError(id, official);
            throw e;
        }
        String group=result.path("GroupId").asText();
        if(group.startsWith("group-")) {
            int saved=revoked?0:db.update("UPDATE video_asset_person SET group_id=?,status='active',ark_error=NULL,token_encrypted=NULL,link_encrypted=NULL,updated_at=? WHERE id=? AND status='verifying'",group,now(),id);
            if(saved==0) {
                deleteGroup(library((String)p.get("library_id")),group);
                db.update("UPDATE video_asset_person SET token_encrypted=NULL,link_encrypted=NULL,updated_at=? WHERE id=? AND status='revoked'",now(),id);
            }
        }
    }
    private void savePersonError(String id, String official) {
        db.update("UPDATE video_asset_person SET ark_error=? WHERE id=? AND status='verifying'", official, id);
    }
    public void revoke(String owner,String id) {
        var p=ownedPerson(owner,id);String lib=(String)p.get("library_id");var record=library(lib);
        // Local revocation takes effect first; failed provider deletion can be retried from this same record.
        db.update("UPDATE video_asset_person SET status='revoked',ark_error=NULL,link_encrypted=NULL,updated_at=? WHERE id=? AND owner_user_id=?",now(),id,owner);
        db.update("UPDATE video_asset_portrait SET status='revoked',error_code=NULL,ark_error=NULL,updated_at=? WHERE person_id=? AND owner_user_id=?",now(),id,owner);
        if(p.get("group_id")!=null) {
            deleteGroup(record,(String)p.get("group_id"));
            db.update("UPDATE video_asset_person SET group_id=NULL,token_encrypted=NULL WHERE id=? AND status='revoked'",id);
        }
    }
    private void deleteGroup(VideoAssetLibraryRecord record,String group) {
        try{api.call(record,"DeleteAssetGroup",Map.of("Id",group));}
        catch(BusinessException e){if(!ArkAssetClient.NOT_FOUND.equals(e.getCode()))throw e;}
    }
    public void forget(String owner,String lib,Collection<String> keys) {
        for(String key:keys)db.update("UPDATE video_asset_portrait SET status='failed',error_code=?,ark_error=NULL,updated_at=? WHERE id=? AND owner_user_id=? AND status='active'",ArkAssetClient.NOT_FOUND,now(),hash(owner,lib,key),owner);
    }
    private Map<String,Object> ownedItem(String owner,String id){return owned("video_asset_portrait",owner,id);}
    private Map<String,Object> ownedPerson(String owner,String id){return owned("video_asset_person",owner,id);}
    private Map<String,Object> owned(String table,String owner,String id) {
        var rows=db.queryForList("SELECT * FROM "+table+" WHERE id=? AND owner_user_id=?",id,owner);
        if(rows.isEmpty())throw BusinessException.notFound("VIDEO_ASSET_NOT_FOUND","未找到该人像记录，请刷新后重试。");return rows.get(0);
    }
    private Item item(Map<String,Object> r) {
        String code=(String)r.get("error_code");
        String official=(String)r.get("ark_error");
        if (official == null && code != null && !code.startsWith("VIDEO_ASSET_") && !code.startsWith("IP_ASSET_")) {
            official = ArkAssetClient.officialError(JSON.createObjectNode().put("Code", code));
        }
        String error=code==null||official!=null?null:switch(code){
            case SUBMISSION_UNKNOWN -> "素材提交结果待确认，请联系技术支持。";
            case "VIDEO_ASSET_RATE_LIMITED" -> "上次提交未完成，请重新提交审核。";
            case "VIDEO_ASSET_REVIEW_TIMEOUT"->"素材审核超时，请稍后重新提交。";
            case ArkAssetClient.NOT_FOUND->"官方素材引用已失效，请重新提交入库。";
            default->"素材入库失败。";};
        return new Item((String)r.get("id"),(String)r.get("library_id"),(String)r.get("source_key"),(String)r.get("media_type"),(String)r.get("label"),
                "image".equals(r.get("media_type"))?storage.signedUrl((String)r.get("source_key")):null,(String)r.get("status"),(String)r.get("placement"),(String)r.get("person_id"),error,iso(r,"updated_at"),SUBMISSION_UNKNOWN.equals(code),official);
    }
    private Person person(Map<String,Object> r) {
        boolean live="verifying".equals(r.get("status"))&&((Timestamp)r.get("expires_at")).toInstant().isAfter(Instant.now());
        return new Person((String)r.get("id"),(String)r.get("library_id"),(String)r.get("name"),"verifying".equals(r.get("status"))&&!live?"failed":(String)r.get("status"),
                live?AepCryptoUtil.decrypt((String)r.get("link_encrypted")):null,iso(r,"expires_at"),iso(r,"created_at"),(String)r.get("ark_error"));
    }
    private static String iso(Map<String,Object> r,String key){return ((Timestamp)r.get(key)).toInstant().toString();}
    private static Timestamp now(){return Timestamp.from(Instant.now());}
    private static String limit(String s,int n){return s==null||s.isBlank()?"人像素材":s.substring(0,Math.min(n,s.length()));}
    static BusinessException review(){return new BusinessException(HttpStatus.CONFLICT,REVIEW_CODE,REVIEW_MESSAGE);}
    private static BusinessException bad(String code,String message){return BusinessException.badRequest(code,message);}
    static String hash(String...parts){try{var digest=MessageDigest.getInstance("SHA-256");for(String s:parts)digest.update((s.length()+":"+s).getBytes(StandardCharsets.UTF_8));return HexFormat.of().formatHex(digest.digest());}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}
