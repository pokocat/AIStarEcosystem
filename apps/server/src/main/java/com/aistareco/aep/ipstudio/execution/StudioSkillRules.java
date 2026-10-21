package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Execution-side view of a skill: stage whitelists, limits and check lists, as an immutable snapshot.
 *
 * <p>The skill files are parsed in exactly one place, {@link StudioSkillCatalog} (fail-fast, strict header); this class
 * only adapts a catalog entry into the {@link Rules} snapshot that planning runs and executions persist, so a newly
 * deployed file never rewrites an accepted plan. The Markdown body is method text and never widens the whitelist.
 */
@Component
public class StudioSkillRules {
    private static final ObjectMapper OM=new ObjectMapper();
    public static final Set<String> STAGES=Set.of("analysis","production");

    public record Rules(String key,String name,int version,String status,Map<String,List<String>> operations,int maxSourceSec,
                        int maxSegments,String maxSegmentSec,int maxSteps,int maxAutoFixPerSegment,List<String> checks,
                        List<String> autoFixChecks,List<String> requiredCapabilities,String body,String digest) {
        public boolean active() {return !"withdrawn".equals(status);}
        public List<String> stageOperations(String stage) {return operations.getOrDefault(stage,List.of());}
        /** {@link StudioSkill#firstStage()}: production-only skills start (and stay) in production. */
        public String firstStage() {return StudioSkill.firstStage(operations);}
        /** Same rule as {@code StudioSkill.direct()}: the production plan is proposed and confirmed directly. */
        public boolean direct() {return "production".equals(firstStage());}
        /** The section of the body that explains how each check is judged; empty when the file has none. */
        public String checkGuide() {
            int start=body.indexOf("## 检查依据");
            if(start<0)return "";
            int end=body.indexOf("\n## ",start+4);
            return body.substring(start,end<0?body.length():end).strip();
        }
    }

    private final ObjectProvider<StudioSkillCatalog> catalog;
    public StudioSkillRules(ObjectProvider<StudioSkillCatalog> catalog) {this.catalog=catalog;}

    public Optional<Rules> find(String key) {
        var source=catalog.getIfAvailable();
        return source==null?Optional.empty():source.find(key).map(StudioSkillRules::rules);
    }

    /** New planning, checks and execution acceptance need a skill that is not withdrawn; existing native runs still settle. */
    public Rules requireActive(String key) {
        var source=catalog.getIfAvailable();
        if(source==null)throw notFound();
        return rules(source.requireForNewWork(key));
    }

    public static BusinessException notFound() {return StudioSkillCatalog.notFound();}

    public static Rules rules(StudioSkill skill) {return fromSnapshot(skill.snapshot(OM));}

    /** Immutable snapshot saved into a planning run's {@code _exec} and the execution state. */
    public static ObjectNode snapshot(Rules rules) {
        ObjectNode out=OM.createObjectNode().put("key",rules.key()).put("name",rules.name()).put("version",rules.version())
                .put("status",rules.status()).put("digest",rules.digest());
        var operations=out.putObject("operations");
        rules.operations().forEach((stage,ops)->{var array=operations.putArray(stage);ops.forEach(array::add);});
        out.putObject("limits").put("maxSourceSec",rules.maxSourceSec()).put("maxSegments",rules.maxSegments())
                .put("maxSegmentSec",rules.maxSegmentSec()).put("maxSteps",rules.maxSteps()).put("maxAutoFixPerSegment",rules.maxAutoFixPerSegment());
        var checks=out.putArray("checks");rules.checks().forEach(checks::add);
        var fixes=out.putArray("autoFixChecks");rules.autoFixChecks().forEach(fixes::add);
        var capabilities=out.putArray("requiredCapabilities");rules.requiredCapabilities().forEach(capabilities::add);
        out.put("body",rules.body());
        return out;
    }

    public static Rules fromSnapshot(JsonNode node) {
        if(node==null||!node.isObject()||!node.path("key").isTextual())throw new IllegalStateException("Skill snapshot missing");
        Map<String,List<String>> operations=new LinkedHashMap<>();
        node.path("operations").fields().forEachRemaining(e->operations.put(e.getKey(),strings(e.getValue())));
        var limits=node.path("limits");
        return new Rules(node.path("key").asText(),node.path("name").asText(),node.path("version").asInt(),node.path("status").asText(),
                Map.copyOf(operations),limits.path("maxSourceSec").asInt(60),limits.path("maxSegments").asInt(8),limits.path("maxSegmentSec").asText("model"),
                limits.path("maxSteps").asInt(12),limits.path("maxAutoFixPerSegment").asInt(0),strings(node.path("checks")),strings(node.path("autoFixChecks")),
                strings(node.path("requiredCapabilities")),node.path("body").asText(""),node.path("digest").asText(""));
    }

    private static List<String> strings(JsonNode array) {
        List<String> out=new ArrayList<>();if(array.isArray())array.forEach(v->out.add(v.asText()));return List.copyOf(out);
    }
}
