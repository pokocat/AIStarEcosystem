import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Mixed MySQL DATETIME writers require reviewed row values, never an inferred offset. */
public final class AistarTemporalPolicy {
    static String sourceZone(JsonNode plan,String key,String rowId,String raw) {
        JsonNode rule=plan.path(key);String zone;
        if(rule.isTextual())zone=rule.asText();
        else {
            if(!Set.of("video_asset_library.created_at","video_asset_library.updated_at").contains(key)
                    ||!"reviewed-library-row-values".equals(rule.path("mode").asText())||rowId==null)
                throw new IllegalStateException("Missing reviewed mixed-writer temporal rule: "+key);
            JsonNode row=rule.path("rows").path(rowId);
            if(!raw.equals(row.path("raw").asText())||row.path("evidence").asText().isBlank())
                throw new IllegalStateException("Library timestamp changed or row unreviewed: "+key);
            zone=row.path("zone").asText();
        }
        if(!Set.of("UTC","Asia/Shanghai").contains(zone))throw new IllegalStateException("Unreviewed temporal zone: "+key);
        return zone;
    }
    public static void main(String[] args)throws Exception {
        if(!Arrays.equals(args,new String[]{"--self-test"}))throw new IllegalArgumentException("Offline tests only");
        var json=new com.fasterxml.jackson.databind.ObjectMapper();var plan=json.createObjectNode();
        var rule=plan.putObject("video_asset_library.created_at");rule.put("mode","reviewed-library-row-values");var rows=rule.putObject("rows");
        rows.putObject("seed").put("raw","2026-11-08 01:07:04.123456").put("zone","Asia/Shanghai").put("evidence","V75 seed");
        rows.putObject("admin").put("raw","2026-11-08 01:07:04.123456").put("zone","UTC").put("evidence","JPA Instant");
        plan.put("video_asset_person.created_at","UTC");int checks=0;
        AistarSnapshotRestore.temporalPlan=plan;AistarRehearsalRestore.temporalPlan=plan;
        for(boolean formal:new boolean[]{false,true}) {
            for(String id:List.of("seed","admin")) {
                byte[] raw="2026-11-08 01:07:04.123456".getBytes(StandardCharsets.UTF_8);
                byte[] result=formal?AistarSnapshotRestore.normalize(raw,"timestamp with time zone","video_asset_library.created_at",true,id)
                        :AistarRehearsalRestore.normalize(raw,"timestamp with time zone","video_asset_library.created_at",true,id);
                String expected=id.equals("seed")?"2026-11-07 17:07:04.123456":"2026-11-08 01:07:04.123456";
                if(!new String(result,StandardCharsets.UTF_8).equals(expected))throw new AssertionError("Mixed writer conversion mismatch");checks++;
            }
        }
        for(String id:new String[]{"unknown",null}) {refused(()->sourceZone(plan,"video_asset_library.created_at",id,"2026-11-08 01:07:04.123456"));checks++;}
        refused(()->sourceZone(plan,"video_asset_library.created_at","seed","2026-11-08 01:07:05.123456"));checks++;
        refused(()->sourceZone(plan,"missing.column","seed","2026-11-08 01:07:04.123456"));checks++;
        if(!sourceZone(plan,"video_asset_person.created_at",null,"2026-11-08 01:07:04").equals("UTC"))throw new AssertionError("TIMESTAMP export contract changed");checks++;
        ((com.fasterxml.jackson.databind.node.ObjectNode)rows.get("admin")).put("zone","Europe/Paris");refused(()->sourceZone(plan,"video_asset_library.created_at","admin","2026-11-08 01:07:04.123456"));checks++;
        System.out.println("Passed "+checks+" mixed-writer temporal checks; no database connection attempted");
    }
    interface Checked {void run()throws Exception;}
    static void refused(Checked task)throws Exception {try{task.run();throw new AssertionError("Unsafe temporal rule accepted");}catch(IllegalStateException expected){}}
}
