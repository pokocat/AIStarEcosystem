package com.aistareco.aep.service.alerts;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.*;

class ModelAlertContextTest {
    JdbcTemplate db; ModelAlertContext context;
    @BeforeEach void setup() {
        db = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:context-"+java.util.UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa",""));
        db.execute("CREATE TABLE material_video_job(id VARCHAR PRIMARY KEY,provider_used VARCHAR,model_used VARCHAR,upstream_base_url_snapshot VARCHAR,variant_config_json VARCHAR,duration_sec INT,aspect_ratio VARCHAR)");
        db.execute("CREATE TABLE ip_run(id VARCHAR PRIMARY KEY,kind VARCHAR,input_json VARCHAR,output_json VARCHAR)");
        db.execute("CREATE TABLE ai_generation_queue(id INT,task_id VARCHAR,endpoint_id VARCHAR)");
        db.execute("CREATE TABLE ai_model_providers(id VARCHAR PRIMARY KEY,name VARCHAR,model VARCHAR,base_url VARCHAR)");
        db.update("INSERT INTO ai_model_providers VALUES ('ep','当前端点','new-model','https://new.example/v2')");
        context = new ModelAlertContext(db);
    }
    @Test void videoUsesOriginalRouteModelAndTaskParametersEvenAfterEndpointChanges() {
        db.update("INSERT INTO material_video_job VALUES (?,?,?,?,?,?,?)","video","原供应商","minimax-h3","https://old.example:10443/v1?token=secret","{\"endpoint_id\":\"ep\",\"generation_mode\":\"i2v\",\"seed\":42,\"first_frame_key\":\"private/key\"}",13,"9:16");
        String text = context.describe("video");
        for(String value: new String[]{"原供应商","minimax-h3","https://old.example:10443/v1","duration_sec\":13","i2v","9:16","seed\":42","非完整上游请求"}) assertTrue(text.contains(value),text);
        for(String value: new String[]{"new-model","new.example","secret","private/key"}) assertFalse(text.contains(value),text);
    }
    @Test void imageUsesFailedItemCheckpointRatherThanPreviouslyCompletedImage() throws Exception {
        var json = new ObjectMapper(); var input = json.createObjectNode(); var exec = input.putObject("_exec").put("endpointId","ep");
        var jobs = exec.putArray("imageJobs");jobs.addObject().put("model","completed-model").put("requestBody","{\"width\":512}");
        jobs.addObject().put("baseUrl","https://images.example/v1").put("model","failed-model").put("requestBody","{\"model\":\"failed-model\",\"width\":1024,\"prompt\":\"private prompt\",\"api_key\":\"secret\",\"images\":[\"https://private?signature=secret\"]}");
        db.update("INSERT INTO ip_run VALUES ('image','generate',?,?)",input.toString(),"{\"candidates\":[{}]}");
        String text = context.describe("image");
        assertTrue(text.contains("failed-model"));assertTrue(text.contains("width\":1024"));assertTrue(text.contains("原请求快照"));assertTrue(text.contains("images_count\":1"));
        for(String value: new String[]{"completed-model","private prompt","api_key","signature","secret"}) assertFalse(text.contains(value),text);
    }
    @Test void speechBodyAndExplicitCurrentConfigFallbackAreVisible() {
        db.update("INSERT INTO ip_run VALUES ('speech','studio-audio',?, '{}')","{\"_exec\":{\"endpointId\":\"ep\",\"requestBody\":\"{\\\"model\\\":\\\"qwen3-tts\\\",\\\"speaker\\\":\\\"Vivian\\\",\\\"text\\\":\\\"private text\\\"}\"}}");
        String text = context.describe("speech");assertTrue(text.contains("qwen3-tts"));assertTrue(text.contains("Vivian"));assertTrue(text.contains("当前端点配置，原调用未记录"));assertFalse(text.contains("private text"));
        db.update("INSERT INTO ai_generation_queue VALUES (1,'unknown','ep')");
        assertTrue(context.describe("unknown").contains("new-model（当前端点配置，原调用未记录）"));
    }
    @Test void missingOrUnreadableContextDoesNotSuppressTheOriginalAlert() {
        assertTrue(context.describe("absent").contains("未记录"));
        db.execute("DROP TABLE material_video_job");assertTrue(context.describe("absent").contains("暂时无法读取"));
    }
    @Test void urlsDropUserInfoQueryAndFragmentAndUnsafeParameterValuesAreNotForwarded() throws Exception {
        assertEquals("https://api.example:8443/v1",ModelAlertContext.safeUrl("https://user:password@api.example:8443/v1?key=secret#token"));
        assertEquals("未记录",ModelAlertContext.safeUrl("file:///secret"));
        String text=ModelAlertContext.parameters(new ObjectMapper().readTree("{\"speaker\":\"Bearer secret\",\"model\":\"https://private?k=secret\",\"authorization\":\"secret\",\"duration\":13}"));
        assertFalse(text.contains("secret"));assertTrue(text.contains("duration\":13"));
    }
}
