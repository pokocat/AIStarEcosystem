package com.aistareco.aep.migration;

import db.migration.V55__video_endpoint_request_specs;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class VideoRequestSpecMigrationTest {
    @Test void addsEndpointContractAndAcceptedJobSnapshots() throws Exception {
        try (var db = DriverManager.getConnection("jdbc:h2:mem:videoSpec" + System.nanoTime() + ";MODE=MySQL")) {
            try (var statement = db.createStatement()) {
                statement.execute("CREATE TABLE ai_model_providers (id VARCHAR(160) PRIMARY KEY)");
                statement.execute("CREATE TABLE material_video_job (id VARCHAR(160) PRIMARY KEY)");
            }
            var context = mock(Context.class);
            when(context.getConnection()).thenReturn(db);
            new V55__video_endpoint_request_specs().migrate(context);
            try (var endpoint = db.prepareStatement("SELECT video_request_spec_json FROM ai_model_providers");
                 var job = db.prepareStatement("SELECT upstream_base_url_snapshot, video_request_spec_snapshot_json FROM material_video_job")) {
                assertTrue(endpoint.executeQuery().getMetaData().getColumnCount() == 1);
                assertTrue(job.executeQuery().getMetaData().getColumnCount() == 2);
            }
        }
    }
}
