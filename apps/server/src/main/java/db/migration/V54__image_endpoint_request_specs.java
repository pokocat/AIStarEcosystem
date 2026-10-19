package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Bootstrap the current published image contracts into editable endpoint records. */
public class V54__image_endpoint_request_specs extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        try(var statement=context.getConnection().createStatement()) {
            statement.executeUpdate("ALTER TABLE ai_model_providers ADD COLUMN image_request_spec_json LONGTEXT NULL");
        }
        // Data migration only: request validation and wire assembly read the saved row, never these literals.
        seed(context,"flux2-klein-4b","""
            {"promptMaxChars":500,"minReferenceImages":0,"maxReferenceImages":5,"referenceField":"multiple","outputs":[
              {"canvasSize":"768x1024","aspectRatio":"3:4","providerFields":{"size":"864x1152"}},
              {"canvasSize":"1024x1024","aspectRatio":"1:1","providerFields":{"size":"1024x1024"}},
              {"canvasSize":"768x1365","aspectRatio":"9:16","providerFields":{"size":"768x1376"}},
              {"canvasSize":"1365x768","aspectRatio":"16:9","providerFields":{"size":"1376x768"}}]}
            """);
        seed(context,"longcat-image-edit","""
            {"promptMaxChars":1200,"minReferenceImages":1,"maxReferenceImages":1,"referenceField":"single","outputs":[
              {"canvasSize":"768x1024","aspectRatio":"3:4","providerFields":{}},
              {"canvasSize":"1024x1024","aspectRatio":"1:1","providerFields":{}},
              {"canvasSize":"768x1365","aspectRatio":"9:16","providerFields":{}},
              {"canvasSize":"1365x768","aspectRatio":"16:9","providerFields":{}}]}
            """);
        seed(context,"ernie-Image","""
            {"promptMaxChars":2048,"minReferenceImages":0,"maxReferenceImages":0,"referenceField":"none","outputs":[
              {"canvasSize":"1024x1024","aspectRatio":"1:1","providerFields":{"resolutionTier":"hd","orientation":"square","imageCount":1}},
              {"canvasSize":"768x1365","aspectRatio":"9:16","providerFields":{"resolutionTier":"720p","orientation":"portrait","imageCount":1}},
              {"canvasSize":"1365x768","aspectRatio":"16:9","providerFields":{"resolutionTier":"720p","orientation":"landscape","imageCount":1}}]}
            """);
    }

    private void seed(Context context,String model,String json)throws Exception {
        try(var statement=context.getConnection().prepareStatement("UPDATE ai_model_providers SET image_request_spec_json=? WHERE default_model=? AND base_url LIKE 'https://api.jusuanhub.com%' AND image_request_spec_json IS NULL")) {
            statement.setString(1,json.strip());statement.setString(2,model);statement.executeUpdate();
        }
    }
}
