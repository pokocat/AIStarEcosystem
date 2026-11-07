package com.aistareco.aep.service.materialvideo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.http.HttpClient;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class OneTokenAssetLibraryTest {
    private static final String CONFIG = "{\"uploadPath\":\"/api/v3/video/assets\",\"fileField\":\"file\","
            + "\"ref\":\"/ref\",\"status\":\"/status\",\"ready\":[\"Active\"],\"expiresAt\":\"/expires_at\"}";
    private final OneTokenAssetLibrary library = new OneTokenAssetLibrary(OneTokenAssetLibrary.Config.read(CONFIG),
            HttpClient.newHttpClient(), Duration.ofSeconds(1));

    @Test
    void readsTheProductionConfig() {
        var config = OneTokenAssetLibrary.Config.read(CONFIG);
        assertEquals("/api/v3/video/assets", config.uploadPath());
        assertEquals("/expires_at", config.expiresAt());
    }

    @Test
    void theRowSeededByTheMigrationIsAConfigThisAdapterAccepts() throws Exception {
        try (var c = java.sql.DriverManager.getConnection("jdbc:h2:mem:v75-adapter;MODE=MySQL;DB_CLOSE_DELAY=-1"); var s = c.createStatement()) {
            s.execute("create table ai_model_providers (id varchar(64) primary key, video_request_spec_json longtext)");
            var ctx = org.mockito.Mockito.mock(org.flywaydb.core.api.migration.Context.class);
            org.mockito.Mockito.when(ctx.getConnection()).thenReturn(c);
            new db.migration.V75__video_asset_library().migrate(ctx);
            try (var r = s.executeQuery("select adapter, config_json from video_asset_library where id='onetoken-main'")) {
                assertTrue(r.next());
                assertEquals("onetoken", r.getString(1));
                assertEquals(OneTokenAssetLibrary.Config.read(CONFIG), OneTokenAssetLibrary.Config.read(r.getString(2)));
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"uploadPath\":\"assets\",\"fileField\":\"file\",\"ref\":\"/ref\"}",
            "{\"uploadPath\":\"/assets/{id}\",\"fileField\":\"file\",\"ref\":\"/ref\"}",
            "{\"uploadPath\":\"//evil/assets\",\"fileField\":\"file\",\"ref\":\"/ref\"}",
            "{\"uploadPath\":\"/a/../b\",\"fileField\":\"file\",\"ref\":\"/ref\"}",
            "{\"uploadPath\":\"/assets\",\"fileField\":\"bad name\",\"ref\":\"/ref\"}",
            "{\"uploadPath\":\"/assets\",\"fileField\":\"file\",\"ref\":\"ref\"}",
            "{\"uploadPath\":\"/assets\",\"fileField\":\"file\"}",
            "{\"uploadPath\":\"/assets\",\"fileField\":\"file\",\"ref\":\"/ref\",\"status\":\"/status\"}",
            "{\"uploadPath\":\"/assets\",\"fileField\":\"file\",\"ref\":\"/ref\",\"ready\":[\"Active\"]}",
            "{\"uploadPath\":\"/assets\",\"fileField\":\"file\",\"ref\":\"/ref\",\"status\":\"/status\",\"ready\":[]}",
            "{\"uploadPath\":\"/assets\",\"fileField\":\"file\",\"ref\":\"/ref\",\"expiresAt\":\"expires_at\"}",
            "not json"})
    void rejectsBadConfig(String json) {
        assertThrows(IllegalArgumentException.class, () -> OneTokenAssetLibrary.Config.read(json), json);
    }

    @Test
    void recognizesTheRealStaleReferenceRefusal() {
        // 2026-11-07 用线上 Key 真调得到的原话，图片和音频的字段名不同。
        assertTrue(library.rejectedStaleReference(400,
                "{\"error\":{\"code\":\"InvalidParameter\",\"message\":\"content[1].image_url: asset not found\"},\"status_message\":{\"state_id\":5}}"));
        assertTrue(library.rejectedStaleReference(400,
                "{\"error\":{\"code\":\"InvalidParameter\",\"message\":\"content[3].audio_url: asset not found\"}}"));
        assertTrue(library.rejectedStaleReference(400,
                "{\"error\":{\"code\":\"InvalidParameter\",\"message\":\"content[2].video_url: asset expired\"}}"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"error\":{\"code\":\"InvalidParameter\",\"message\":\"content[1].image_url: image too small\"}}",
            "{\"error\":{\"code\":\"InvalidParameter\",\"message\":\"duration not supported\"}}",
            "{\"error\":{\"code\":\"model_delisted\",\"message\":\"asset not found\"}}",
            "{\"error\":{\"code\":\"InvalidParameter\",\"message\":\"model not found\"}}",
            "not json",
            ""})
    void otherRefusalsAreNotStale(String body) {
        assertFalse(library.rejectedStaleReference(400, body), body);
    }

    @Test
    void onlyA400CountsAsARefusal() {
        String body = "{\"error\":{\"code\":\"InvalidParameter\",\"message\":\"content[1].image_url: asset not found\"}}";
        assertFalse(library.rejectedStaleReference(500, body));
        assertFalse(library.rejectedStaleReference(404, body));
    }

    @Test
    void accessNeverPrintsTheCredential() {
        var access = new VideoAssetLibrary.EndpointAccess("OneToken", "https://x", "m", "Authorization", "Bearer sk-secret");
        assertFalse(access.toString().contains("sk-secret"));
    }
}
