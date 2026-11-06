import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;

/** Scope and time checks shared by the real importer and its offline refusal tests. */
public final class AistarCutoverGuard {
    static final ObjectMapper JSON=new ObjectMapper();
    static final String HOST="pgm-bp1gp4819mbs30z3.pg.rds.aliyuncs.com";
    static final List<String> PENDING_WORK=List.of("ip_run","material_video_job","aep_publish_jobs","clip_render_job","clip_shot_job","music_gen_job","video_studio_prompt_optimization","ai_generation_queue","ip_dialogue_message","ip_plan_execution");
    static void require(boolean value,String message) { if(!value)throw new IllegalStateException(message); }
    static void privateFile(Path p)throws Exception {
        require(!Files.isSymbolicLink(p)&&Files.isRegularFile(p),"Private regular file required");
        require(Files.getOwner(p).getName().equals("root")&&Files.getPosixFilePermissions(p).equals(PosixFilePermissions.fromString("rw-------")),"root:600 required");
        require(p.toRealPath().getParent().equals(Path.of("/opt/aistar-migration/preparation")),"Protected preparation path required");
    }
    public static void checkMode(String mode,JsonNode p,Instant now) {
        boolean production=mode.equals("production");
        require(production||mode.equals("drill"),"Unknown import mode");
        require(p.path("format").asText().equals("aistar-import-permit-v1"),"Import permit format mismatch");
        require(p.path("rds_host").asText().equals(HOST),"Wrong RDS endpoint");
        require(p.path("database").asText().equals(production?"aistar_prod":"aistar_cutover_drill"),"Database scope mismatch");
        require(p.path("role").asText().equals(production?"aistar_migrator":"aistar_rehearsal"),"Import role mismatch");
        require(p.path("table_count").asInt()==192&&p.path("flyway_version").asText().equals("77"),"Unreviewed schema contract");
        for(String field:List.of("snapshot_sha256","source_artifact_sha256","source_schema_sha256","temporal_plan_sha256","source_critical_environment_sha256"))require(p.path(field).asText().matches("[a-f0-9]{64}"),"Missing immutable identity: "+field);
        if(production) {
            require(p.path("production_authorized").asBoolean(false),"No explicitly authorized production window");
            Instant start=Instant.parse(p.path("window_start_utc").asText()),end=Instant.parse(p.path("window_end_utc").asText());
            require(start.isBefore(end)&&Duration.between(start,end).compareTo(Duration.ofHours(2))<=0,"Invalid maintenance window");
            require(!now.isBefore(start)&&now.isBefore(end),"Outside authorized window");
            require(p.path("source_unit").asText().equals("aistareco-server")&&p.path("source_pid_after_freeze").asLong(-1)==0,"Source unit not frozen");
            require(p.path("write_gate_closed").asBoolean(false)&&p.path("source_background_stopped").asBoolean(false)&&p.path("sau_idle").asBoolean(false),"Missing ingress/background/SAU drain proof");
            require(p.path("sms_lock_quarantine_complete").asBoolean(false),"Source in-memory SMS state not handled");
            require(p.path("pending_work").isObject()&&p.path("pending_work").size()>0,"Missing pending-work proof");
            PENDING_WORK.forEach(name->require(p.path("pending_work").has(name),"Missing source work counter: "+name));
            p.path("pending_work").fields().forEachRemaining(e->require(e.getValue().isIntegralNumber()&&e.getValue().asLong()==0,"Unfinished source work"));
        } else require(p.path("purpose").asText().equals("aistar-cutover-drill"),"Explicit isolated drill required");
    }
    public static void checkSnapshot(String mode,JsonNode permit,JsonNode meta,Instant now) {
        checkMode(mode,permit,now);
        require(meta!=null&&meta.path("type").asText().equals("snapshot_metadata")&&meta.path("database").asText().equals("aistareco"),"Wrong source metadata");
        require(meta.path("table_count").asInt()==192,"Source schema count changed");
        for(String field:List.of("source_artifact_sha256","source_schema_sha256"))require(meta.path(field).asText().equals(permit.path(field).asText()),"Source drift: "+field);
        require(meta.path("source_jvm_timezone").asText().equals("Asia/Shanghai")&&meta.path("source_jdbc_timezone").asText().equals("Asia/Shanghai"),"Source temporal contract changed");
        Instant capture=Instant.parse(meta.path("captured_utc").asText());require(!capture.isAfter(now.plusSeconds(2)),"Future snapshot");
        if(mode.equals("production")) {
            require(meta.path("source_frozen").asBoolean(false),"Live rehearsal snapshot cannot enter production");
            Instant frozen=Instant.parse(meta.path("source_freeze_utc").asText());
            require(!frozen.isBefore(Instant.parse(permit.path("window_start_utc").asText()))&&!frozen.isAfter(capture)&&!capture.isAfter(now.plusSeconds(2)),"Inconsistent freeze/capture boundary");
            require(!frozen.isAfter(now)&&Duration.between(frozen,now).compareTo(Duration.ofMinutes(30))<0,"Frozen snapshot is stale");
            require(meta.path("source_freeze_utc").asText().equals(permit.path("source_freeze_utc").asText()),"Permit and snapshot are from different freezes");
        }
    }
    static void checkMigrations(Path schema,JsonNode permit)throws Exception {
        var expected=new TreeMap<String,String>();
        for(var entry:permit.path("migrations"))require(expected.put(entry.path("name").asText(),entry.path("sha256").asText())==null,"Duplicate migration");
        require(!expected.isEmpty(),"Pinned migrations missing");var actual=new TreeMap<String,String>();
        try(var paths=Files.list(schema)) { for(Path p:paths.filter(p->p.getFileName().toString().matches("V[0-9]+__.*\\.sql")).toList())actual.put(p.getFileName().toString(),HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(p)))); }
        require(expected.equals(actual),"Migration set or bytes changed");
    }
    static ObjectNode permit() {
        ObjectNode p=JSON.createObjectNode();p.put("format","aistar-import-permit-v1");p.put("rds_host",HOST);p.put("database","aistar_prod");p.put("role","aistar_migrator");p.put("table_count",192);p.put("flyway_version","77");
        for(String field:List.of("snapshot_sha256","source_artifact_sha256","source_schema_sha256","temporal_plan_sha256","source_critical_environment_sha256"))p.put(field,"a".repeat(64));
        p.put("production_authorized",true);p.put("window_start_utc","2026-01-01T01:00:00Z");p.put("window_end_utc","2026-01-01T03:00:00Z");p.put("source_unit","aistareco-server");p.put("source_pid_after_freeze",0);p.put("write_gate_closed",true);p.put("source_background_stopped",true);p.put("sau_idle",true);p.put("sms_lock_quarantine_complete",true);ObjectNode work=p.putObject("pending_work");PENDING_WORK.forEach(name->work.put(name,0));p.put("source_freeze_utc","2026-01-01T01:05:00Z");return p;
    }
    public static void main(String[] args) {
        require(Arrays.equals(args,new String[]{"--self-test"}),"Only offline guard self-test is exposed");Instant now=Instant.parse("2026-01-01T01:10:00Z");ObjectNode p=permit();ObjectNode m=JSON.createObjectNode();m.put("type","snapshot_metadata");m.put("database","aistareco");m.put("table_count",192);m.put("source_artifact_sha256","a".repeat(64));m.put("source_schema_sha256","a".repeat(64));m.put("source_jvm_timezone","Asia/Shanghai");m.put("source_jdbc_timezone","Asia/Shanghai");m.put("captured_utc","2026-01-01T01:06:00Z");m.put("source_frozen",true);m.put("source_freeze_utc",p.path("source_freeze_utc").asText());checkSnapshot("production",p,m,now);int checked=1;
        for(String field:List.of("production_authorized","write_gate_closed","source_background_stopped","sau_idle","sms_lock_quarantine_complete")) { ObjectNode bad=p.deepCopy();bad.put(field,false);refused(()->checkSnapshot("production",bad,m,now));checked++; }
        for(String field:List.of("database","role","rds_host","source_unit","source_artifact_sha256","source_schema_sha256")) { ObjectNode bad=p.deepCopy();bad.put(field,"wrong");refused(()->checkSnapshot("production",bad,m,now));checked++; }
        ObjectNode bad=p.deepCopy();bad.put("source_pid_after_freeze",123);refused(()->checkSnapshot("production",bad,m,now));checked++;
        ObjectNode busy=p.deepCopy();((ObjectNode)busy.path("pending_work")).put("generation",1);refused(()->checkSnapshot("production",busy,m,now));checked++;
        ObjectNode missing=p.deepCopy();((ObjectNode)missing.path("pending_work")).remove("ip_plan_execution");refused(()->checkSnapshot("production",missing,m,now));checked++;
        ObjectNode plans=p.deepCopy();((ObjectNode)plans.path("pending_work")).put("ip_plan_execution",1);refused(()->checkSnapshot("production",plans,m,now));checked++;
        ObjectNode live=m.deepCopy();live.put("source_frozen",false);refused(()->checkSnapshot("production",p,live,now));checked++;
        refused(()->checkSnapshot("production",p,m,now.minusSeconds(3600)));checked++;
        refused(()->checkSnapshot("production",p,m,now.plusSeconds(1800)));checked++;
        ObjectNode drill=p.deepCopy();drill.put("database","aistar_cutover_drill");drill.put("role","aistar_rehearsal");drill.put("purpose","aistar-cutover-drill");drill.put("production_authorized",false);checkSnapshot("drill",drill,live,now);checked++;
        System.out.println("Passed "+checked+" actual importer guard checks; no database connection attempted");
    }
    static void refused(Runnable code) {try{code.run();throw new AssertionError("Unsafe import was accepted");}catch(IllegalStateException|java.time.format.DateTimeParseException expected){}}
}
