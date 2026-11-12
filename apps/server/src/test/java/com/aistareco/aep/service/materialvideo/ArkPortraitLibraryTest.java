package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import db.migration.V78__ark_portrait_library;
import db.migration.V82__portrait_review_queue;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.http.HttpStatus;
import java.sql.*;
import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ArkPortraitLibraryTest {
    private Connection connection;private JdbcTemplate db;private ArkAssetClient api;private ArkPortraitLibrary service;
    private VideoAssetLibraryRecord record;private FileStorageService storage;
    private final ObjectMapper json=new ObjectMapper();
    @BeforeEach void setup() throws Exception {
        connection=DriverManager.getConnection("jdbc:h2:mem:portrait-"+UUID.randomUUID()+";MODE=MySQL");
        var dataSource = new SingleConnectionDataSource(connection, true);
        db = new JdbcTemplate(dataSource);
        db.execute("CREATE TABLE video_asset_library(id VARCHAR(64) PRIMARY KEY,adapter VARCHAR(32),updated_at TIMESTAMP)");
        db.update("INSERT INTO video_asset_library VALUES('ark-test','ark',?)", Timestamp.from(Instant.now().minusSeconds(60)));
        Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(connection);new V78__ark_portrait_library().migrate(ctx);
        new V82__portrait_review_queue().migrate(ctx);
        var libraries=mock(VideoAssetLibraryRecordRepository.class);record=new VideoAssetLibraryRecord();record.setId("ark-test");record.setName("官方人像");record.setAdapter("ark");record.setCredentialEncrypted(AepCryptoUtil.encrypt("test:secret"));record.setConfigJson("{\"projectName\":\"test\",\"virtualGroupId\":\"group-virtual\"}");
        when(libraries.findById("ark-test")).thenReturn(Optional.of(record));when(libraries.findAll()).thenReturn(List.of(record));
        api=mock(ArkAssetClient.class);storage=mock(FileStorageService.class);when(storage.signedUrl(anyString())).thenAnswer(i->"preview:"+i.getArgument(0));when(storage.upstreamFetchUrl(anyString())).thenAnswer(i->"https://signed.example/"+i.getArgument(0));
        var projects=mock(IpProjectService.class);when(projects.requireOwnedAssetKey(anyString(),anyString())).thenAnswer(i->i.getArgument(1));
        service=new ArkPortraitLibrary(db,libraries,api,storage,projects,new DataSourceTransactionManager(dataSource),"https://api.example");
    }
    @AfterEach void close() throws Exception {connection.close();}
    private ArkPortraitLibrary.Item image(){return service.register("owner","ark-test","source/owner/portrait.jpg","image","人物");}
    private void uploadReturns(String id) throws Exception {when(api.call(eq(record),eq("CreateAsset"),anyMap())).thenReturn(json.readTree("{\"Id\":\""+id+"\"}"));}
    @Test void undeclaredSceneKeepsItsUrlAndKnownPortraitCannotBypassReview() {
        assertEquals("https://signed.example/scene.jpg",service.reference("owner","ark-test","scene.jpg"));image();
        assertEquals("VIDEO_ASSET_NEEDS_REVIEW",assertThrows(BusinessException.class,()->service.reference("owner","ark-test","source/owner/portrait.jpg")).getCode());
        verifyNoInteractions(api);
    }
    @Test void mapsProviderContentIndexIncludingTheLeadingTextAndIsolatesOwners() {
        var spec=new VideoGenSpec("universal_reference_video","720p",null,null,null,List.of(new VideoGenSpec.Reference("image","first.jpg"),new VideoGenSpec.Reference("image","second.jpg")),false);
        assertTrue(service.flag("owner","ark-test",spec,400,"{\"error\":{\"code\":\"InputImageSensitiveContentDetected.PrivacyInformation\",\"message\":\"content[2].image_url may contain real person\"}}"));
        assertEquals("second.jpg",service.overview("owner").items().get(0).key());assertTrue(service.overview("other").items().isEmpty());
        String id=service.overview("owner").items().get(0).id();
        assertThrows(BusinessException.class,()->service.declare("other",id,"virtual",null,true,ArkPortraitLibrary.VERSION));
        assertFalse(service.flag("owner","ark-test",spec,503,"timeout"));verifyNoInteractions(api);
    }
    @Test void virtualDeclarationRequiresConsentAndVersionBeforeAnyProviderWrite() {
        var item=image();
        assertThrows(BusinessException.class,()->service.declare("owner",item.id(),"virtual",null,false,ArkPortraitLibrary.VERSION));
        assertThrows(BusinessException.class,()->service.declare("owner",item.id(),"virtual",null,true,"old"));verifyNoInteractions(api);
    }
    @Test void ingestionWaitsForOfficialActiveAndReusesOneReceipt() throws Exception {
        var item=image();uploadReturns("asset-image");
        assertEquals("queued",service.declare("owner",item.id(),"virtual",null,true,ArkPortraitLibrary.VERSION).status());
        service.declare("owner",item.id(),"virtual",null,true,ArkPortraitLibrary.VERSION);
        assertThrows(BusinessException.class,()->service.reference("owner","ark-test",item.key()));
        when(api.call(eq(record),eq("GetAsset"),anyMap())).thenReturn(json.readTree("{\"Status\":\"Active\"}"));
        sendAndPoll();
        assertEquals("active",service.refreshItem("owner",item.id()).status());
        assertEquals("asset://asset-image",service.reference("owner","ark-test",item.key()));
        assertEquals("asset://asset-image",service.reference("owner","ark-test",item.key()));
        var spec=new VideoGenSpec("universal_reference_video","720p",null,null,null,
                List.of(new VideoGenSpec.Reference("image",item.key())),false);
        assertFalse(service.flag("owner","ark-test",spec,400,
                "{\"error\":{\"code\":\"InputImageSensitiveContentDetected.PrivacyInformation\",\"message\":\"content[1] may contain real person\"}}"),
                "an explicit rejection of an approved reference must not reopen an automatic resume loop");
        verify(api,times(1)).call(eq(record),eq("CreateAsset"),anyMap());
        assertEquals(ArkPortraitLibrary.VIRTUAL_DECLARATION,db.queryForObject("SELECT declaration_text FROM video_asset_portrait WHERE id=?",String.class,item.id()));
    }
    private void allowUpload() {
        db.update("UPDATE video_asset_library SET portrait_upload_after=NULL WHERE id='ark-test'");
    }

    private void sendAndPoll() {
        service.dispatchQueued();
        db.update("UPDATE video_asset_portrait SET review_after=NULL WHERE status='processing'");
        service.pollReviews();
    }

    @Test void batchUsesSharedQuotaAndResumesAfterProviderThrottle() throws Exception {
        var first = image();
        var second = service.register("owner", "ark-test", "second.jpg", "image", "第二张");
        var ids = List.of(first.id(), second.id());
        assertEquals(List.of("queued", "queued"), service.declareBatch("owner", ids, "virtual", null, true,
                ArkPortraitLibrary.VERSION).stream().map(ArkPortraitLibrary.Item::status).toList());
        assertEquals("queued", service.declare("owner", second.id(), "virtual", null, true, ArkPortraitLibrary.VERSION).status());
        verifyNoInteractions(api);
        when(api.call(eq(record), eq("CreateAsset"), anyMap()))
                .thenThrow(new BusinessException(HttpStatus.TOO_MANY_REQUESTS, ArkAssetClient.RATE_LIMITED, "throttled"))
                .thenReturn(json.readTree("{\"Id\":\"asset-first\"}"), json.readTree("{\"Id\":\"asset-second\"}"));
        service.dispatchQueued();
        service.dispatchQueued();
        assertEquals(List.of("queued", "queued"), service.overview("owner").items().stream().map(ArkPortraitLibrary.Item::status).toList());
        verify(api, times(1)).call(eq(record), eq("CreateAsset"), anyMap());
        allowUpload();
        service.dispatchQueued();
        service.dispatchQueued();
        assertEquals(1, service.overview("owner").items().stream().filter(i -> "processing".equals(i.status())).count());
        verify(api, times(2)).call(eq(record), eq("CreateAsset"), anyMap());
        allowUpload();
        service.dispatchQueued();
        assertTrue(service.overview("owner").items().stream().allMatch(i -> "processing".equals(i.status())));
        verify(api, times(3)).call(eq(record), eq("CreateAsset"), anyMap());
    }

    @Test void batchRejectsForeignRecordWithoutQueueingAnyPhotos() {
        var own = image();
        var other = service.register("other", "ark-test", "second.jpg", "image", "第二张");
        assertThrows(BusinessException.class, () -> service.declareBatch("owner", List.of(own.id(), other.id()),
                "virtual", null, true, ArkPortraitLibrary.VERSION));
        assertEquals("needs_review", service.overview("owner").items().get(0).status());
        verifyNoInteractions(api);
    }

    @Test void providerThrottleWithoutJsonIsStillRecognized() throws Exception {
        var http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(429);
        when(response.body()).thenReturn("");
        when(http.send(any(), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
        var client = new ArkAssetClient(http);
        assertEquals(ArkAssetClient.RATE_LIMITED, assertThrows(BusinessException.class,
                () -> client.call(record, "CreateAsset", Map.of())).getCode());
    }

    @Test void uncertainSubmissionIsNeverDispatchedAgain() {
        var item = image();
        service.declare("owner", item.id(), "virtual", null, true, ArkPortraitLibrary.VERSION);
        when(api.call(eq(record), eq("CreateAsset"), anyMap()))
                .thenThrow(new BusinessException(HttpStatus.BAD_GATEWAY, ArkAssetClient.SUBMISSION_UNKNOWN, "unknown"));
        service.dispatchQueued();
        assertTrue(service.declare("owner", item.id(), "virtual", null, true, ArkPortraitLibrary.VERSION).submissionUnknown());
        allowUpload();
        service.dispatchQueued();
        verify(api, times(1)).call(eq(record), eq("CreateAsset"), anyMap());
    }

    @Test void callbackMustConfirmWithOfficialApiAndSessionCreationIsIdempotent() throws Exception {
        when(api.call(eq(record),eq("CreateVisualValidateSession"),anyMap())).thenReturn(json.readTree("{\"H5Link\":\"https://verify.example/?secret=one\",\"BytedToken\":\"private-token\"}"));
        var p=service.startPerson("owner","ark-test","本人","test-request-123456",true,ArkPortraitLibrary.VERSION);
        assertEquals(p.id(),service.startPerson("owner","ark-test","本人","test-request-123456",true,ArkPortraitLibrary.VERSION).id());
        assertThrows(BusinessException.class,()->service.callback("forged-resultCode-10000"));
        assertTrue(service.overview("other").persons().isEmpty());
        assertNotEquals("private-token",db.queryForObject("SELECT token_encrypted FROM video_asset_person WHERE id=?",String.class,p.id()));
        assertEquals("verifying",service.overview("owner").persons().get(0).status());
        when(api.call(eq(record),eq("GetVisualValidateResult"),anyMap())).thenReturn(json.readTree("{\"GroupId\":\"group-real\"}"));
        assertEquals("active",service.refreshPerson("owner",p.id()).status());
        assertNull(service.overview("owner").persons().get(0).verificationUrl());
        assertNull(db.queryForObject("SELECT token_encrypted FROM video_asset_person WHERE id=?",String.class,p.id()));
        verify(api,times(1)).call(eq(record),eq("CreateVisualValidateSession"),anyMap());
    }
    @Test void revokedPersonCannotBeUsedAndProviderDeletionCanBeRetried() throws Exception {
        when(api.call(eq(record),eq("CreateVisualValidateSession"),anyMap())).thenReturn(json.readTree("{\"H5Link\":\"https://verify.example\",\"BytedToken\":\"private-token\"}"));
        var p=service.startPerson("owner","ark-test","本人","test-request-123456",true,ArkPortraitLibrary.VERSION);
        when(api.call(eq(record),eq("GetVisualValidateResult"),anyMap())).thenReturn(json.readTree("{\"GroupId\":\"group-real\"}"));service.refreshPerson("owner",p.id());
        var item=image();uploadReturns("asset-person");service.declare("owner",item.id(),"person",p.id(),true,ArkPortraitLibrary.VERSION);
        when(api.call(eq(record),eq("GetAsset"),anyMap())).thenReturn(json.readTree("{\"Status\":\"Active\"}"));sendAndPoll();
        assertEquals("asset://asset-person",service.reference("owner","ark-test",item.key()));
        var pending = service.register("owner", "ark-test", "another.jpg", "image", "另一张");
        service.declare("owner", pending.id(), "person", p.id(), true, ArkPortraitLibrary.VERSION);
        service.revoke("owner",p.id());assertThrows(BusinessException.class,()->service.reference("owner","ark-test",item.key()));
        assertThrows(BusinessException.class,()->service.declare("owner",item.id(),"person",p.id(),true,ArkPortraitLibrary.VERSION));
        allowUpload();
        service.dispatchQueued();
        verify(api, times(1)).call(eq(record), eq("CreateAsset"), anyMap());
        verify(api).call(record,"DeleteAssetGroup",Map.of("Id","group-real"));
    }
    @Test void failedAssetHttp200IsNotTreatedAsSuccess() throws Exception {
        var item=image();uploadReturns("asset-image");service.declare("owner",item.id(),"virtual",null,true,ArkPortraitLibrary.VERSION);
        when(api.call(eq(record),eq("GetAsset"),anyMap())).thenReturn(json.readTree("{\"Status\":\"Failed\",\"Error\":{\"Code\":\"FaceMismatch\"}}"));
        sendAndPoll();
        var failed=service.refreshItem("owner",item.id());assertEquals("failed",failed.status());assertTrue(failed.errorMessage().contains("本人不一致"));
        assertThrows(BusinessException.class,()->service.reference("owner","ark-test",item.key()));
    }
}
