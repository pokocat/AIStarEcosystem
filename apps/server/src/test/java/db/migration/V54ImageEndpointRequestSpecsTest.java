package db.migration;

import com.aistareco.aep.model.AiImageRequestSpec;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class V54ImageEndpointRequestSpecsTest {
    @Test void seedsCurrentJusuanModelsAndLeavesOtherSuppliersAlone() throws Exception {
        try(var connection=DriverManager.getConnection("jdbc:h2:mem:image-spec-v54;MODE=MySQL")) {
            try(var statement=connection.createStatement()) {
                statement.executeUpdate("CREATE TABLE ai_model_providers (id VARCHAR(80), default_model VARCHAR(80), base_url VARCHAR(512))");
                statement.executeUpdate("INSERT INTO ai_model_providers VALUES ('ernie','ernie-Image','https://api.jusuanhub.com/v1'),('flux','flux2-klein-4b','https://api.jusuanhub.com/v1'),('longcat','longcat-image-edit','https://api.jusuanhub.com/v1'),('other','ernie-Image','https://example.com/v1')");
            }
            Context context=mock(Context.class);when(context.getConnection()).thenReturn(connection);
            new V54__image_endpoint_request_specs().migrate(context);
            try(var statement=connection.createStatement();var rows=statement.executeQuery("SELECT id,image_request_spec_json FROM ai_model_providers ORDER BY id")) {
                while(rows.next()) {
                    String id=rows.getString(1),json=rows.getString(2);
                    if("other".equals(id)){assertNull(json);continue;}
                    var spec=AiImageRequestSpec.read(json);assertNotNull(spec);
                    if("ernie".equals(id)) {
                        assertNull(spec.output("768x1024"));
                        assertEquals("hd",spec.output("1024x1024").providerFields().get("resolutionTier"));
                        assertEquals("square",spec.output("1024x1024").providerFields().get("orientation"));
                    }
                    if("flux".equals(id))assertEquals("864x1152",spec.output("768x1024").providerFields().get("size"));
                    if("longcat".equals(id))assertEquals(1,spec.minReferenceImages());
                }
            }
        }
    }
}
