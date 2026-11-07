package db.migration;

import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class V75VideoAssetLibraryTest {
    private static final String WITH_LIBRARY = "{\"adapter\":\"seedance\",\"inputAssets\":{\"uploadPath\":\"/api/v3/video/assets\"}}";

    private static Context context(Connection c) {
        Context ctx = mock(Context.class);
        when(ctx.getConnection()).thenReturn(c);
        return ctx;
    }

    private static String libraryOf(Connection c, String id) throws Exception {
        try (var s = c.createStatement(); var r = s.executeQuery("select asset_library_id from ai_model_providers where id='" + id + "'")) {
            assertTrue(r.next());
            return r.getString(1);
        }
    }

    @Test
    void bindsOnlyTheEndpointsThatHadAnAssetLibraryAndIsRepeatable() throws Exception {
        try (var c = DriverManager.getConnection("jdbc:h2:mem:v75;MODE=MySQL;DB_CLOSE_DELAY=-1"); var s = c.createStatement()) {
            s.execute("create table ai_model_providers (id varchar(64) primary key, video_request_spec_json longtext)");
            s.execute("insert into ai_model_providers values ('ot20', '" + WITH_LIBRARY + "'), ('ot25', '" + WITH_LIBRARY + "'),"
                    + " ('volc', '{\"adapter\":\"seedance\"}'), ('text', null)");

            new V75__video_asset_library().migrate(context(c));
            new V75__video_asset_library().migrate(context(c));

            assertEquals("onetoken-main", libraryOf(c, "ot20"));
            assertEquals("onetoken-main", libraryOf(c, "ot25"));
            assertNull(libraryOf(c, "volc"));
            assertNull(libraryOf(c, "text"));
            try (var r = s.executeQuery("select count(*), max(adapter), max(config_json) from video_asset_library")) {
                assertTrue(r.next());
                assertEquals(1, r.getInt(1));
                assertEquals("onetoken", r.getString(2));
                // 种子配置必须是新版能读、线上一直在用的那份。
                assertTrue(r.getString(3).contains("/api/v3/video/assets"));
                assertTrue(r.getString(3).contains("/expires_at"));
            }
            // 规格里的旧字段不动：回滚到旧版还要靠它。
            try (var r = s.executeQuery("select video_request_spec_json from ai_model_providers where id='ot20'")) {
                assertTrue(r.next());
                assertEquals(WITH_LIBRARY, r.getString(1));
            }
        }
    }

    @Test
    void freshSchemaIsLeftToHibernate() throws Exception {
        try (var c = DriverManager.getConnection("jdbc:h2:mem:v75-fresh;MODE=MySQL;DB_CLOSE_DELAY=-1")) {
            new V75__video_asset_library().migrate(context(c));
            try (var r = c.getMetaData().getTables(c.getCatalog(), null, "VIDEO_ASSET_LIBRARY", null)) {
                assertFalse(r.next());
            }
        }
    }
}
