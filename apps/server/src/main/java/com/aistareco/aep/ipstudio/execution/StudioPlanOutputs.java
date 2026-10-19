package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Read-only view of an execution's real native outputs. Every key comes from an owned native run of this execution (or an
 * owned canvas node); nothing here is trusted from the client, the model or the canvas document's derived URLs.
 */
@Component
public class StudioPlanOutputs {
    private final IpRunRepository runs;
    private final IpProjectService projects;
    private final ObjectMapper mapper;
    public StudioPlanOutputs(IpRunRepository runs,IpProjectService projects,ObjectMapper mapper) {
        this.runs=runs;this.projects=projects;this.mapper=mapper;
    }

    /** The native run projection (status, actual cost, output) of an owned run of this project. */
    public Optional<IpRunDto> run(String userId,String projectId,String runId) {
        return projects.ownedRun(userId,projectId,runId).map(projects::toRunDto);
    }

    /** The run a downstream step uses: the user's accepted run, else the latest successful attempt. */
    public Optional<String> chosenRun(String userId,String projectId,JsonNode step) {
        String accepted=step.path("acceptedRunId").asText("");
        if(!accepted.isEmpty())return Optional.of(accepted);
        List<String> ids=new ArrayList<>();step.path("runIds").forEach(id->ids.add(id.asText()));
        Collections.reverse(ids);
        for(String id:ids) {
            var dto=run(userId,projectId,id).orElse(null);
            if(dto!=null&&"done".equals(dto.status()))return Optional.of(id);
        }
        return Optional.empty();
    }

    /** Primary media key of a run output; {@code candidate} selects among image/video candidates (default: first success). */
    public String outputKey(IpRunDto dto,Integer candidate) {
        JsonNode output=dto.output()==null?mapper.createObjectNode():dto.output();
        JsonNode videos=output.path("videoCandidates");
        if(videos.isArray()&&!videos.isEmpty()) {
            if(candidate!=null) {
                JsonNode chosen=videos.path(candidate);
                return "done".equals(chosen.path("status").asText())?chosen.path("storageKey").asText(null):null;
            }
            for(JsonNode v:videos)if("done".equals(v.path("status").asText()))return v.path("storageKey").asText(null);
            return null;
        }
        JsonNode images=output.path("candidates");
        if(images.isArray()&&!images.isEmpty()) {
            int index=candidate==null?0:candidate;
            return index<images.size()?images.get(index).path("key").asText(null):null;
        }
        return output.path("storageKey").asText(null);
    }

    /** Every real key a run produced (all candidates); the only keys a check may target. */
    public List<String> outputKeys(IpRunDto dto) {
        JsonNode output=dto.output()==null?mapper.createObjectNode():dto.output();
        List<String> keys=new ArrayList<>();
        for(JsonNode v:output.path("videoCandidates"))if("done".equals(v.path("status").asText())&&v.hasNonNull("storageKey"))keys.add(v.path("storageKey").asText());
        for(JsonNode c:output.path("candidates"))if(c.hasNonNull("key"))keys.add(c.path("key").asText());
        if(keys.isEmpty()&&output.hasNonNull("storageKey"))keys.add(output.path("storageKey").asText());
        return keys;
    }

    /**
     * Output nodes the execution projects to the canvas: one per finished step plus one per film-study segment clip.
     * The plan compiler may bind these ids; the resolver below maps them back to the real keys.
     */
    public ArrayNode outputNodes(IpPlanExecution execution,JsonNode steps) {
        ArrayNode out=mapper.createArrayNode();
        for(JsonNode step:steps) {
            if(!"done".equals(step.path("status").asText()))continue;
            String runId=chosenRun(execution.getOwnerUserId(),execution.getProjectId(),step).orElse(null);
            if(runId==null)continue;
            var dto=run(execution.getOwnerUserId(),execution.getProjectId(),runId).orElse(null);
            if(dto==null)continue;
            String stage=step.path("stage").asText(),id=step.path("id").asText(),operation=step.path("operation").asText();
            String nodeId=StudioPlanExecutionIds.nodeId(execution.getId(),stage,id);
            JsonNode output=dto.output()==null?mapper.createObjectNode():dto.output();
            var node=out.addObject().put("nodeId",nodeId).put("stepId",id).put("stage",stage).put("runId",runId)
                    .put("title",step.path("title").asText()).put("operation",operation);
            switch(operation) {
                case "image" -> node.put("type","image");
                case "video","assemble" -> node.put("type","video").put("durationSec",output.path("durationSec").asDouble(0));
                case "recreation" -> {
                    node.put("type","text");
                    for(JsonNode segment:output.path("filmStudy").path("segments")) {
                        if(!segment.hasNonNull("storageKey"))continue;
                        out.addObject().put("nodeId",StudioPlanExecutionIds.segmentNodeId(execution.getId(),stage,id,segment.path("no").asInt()))
                                .put("stepId",id).put("stage",stage).put("runId",runId).put("operation","recreation").put("type","video")
                                .put("segmentNo",segment.path("no").asInt()).put("title",segment.path("title").asText("片段 "+segment.path("no").asInt()))
                                .put("startSec",segment.path("startSec").asDouble()).put("endSec",segment.path("endSec").asDouble())
                                .put("durationSec",segment.path("durationSec").asDouble(segment.path("endSec").asDouble()-segment.path("startSec").asDouble()));
                    }
                }
                default -> node.put("type","text");
            }
        }
        return out;
    }

    /** Analysis facts for the production plan compiler: film-study segments, recreation report and text outputs. */
    public String analysis(IpPlanExecution execution,JsonNode steps) {
        StringBuilder out=new StringBuilder();
        for(JsonNode step:steps) {
            if(!"done".equals(step.path("status").asText()))continue;
            String runId=chosenRun(execution.getOwnerUserId(),execution.getProjectId(),step).orElse(null);
            var dto=runId==null?null:run(execution.getOwnerUserId(),execution.getProjectId(),runId).orElse(null);
            if(dto==null||dto.output()==null)continue;
            JsonNode output=dto.output();
            String stage=step.path("stage").asText(),id=step.path("id").asText();
            out.append("## ").append(step.path("title").asText()).append('\n');
            if(output.has("filmStudy")) {
                out.append("原片时长 ").append(output.path("filmStudy").path("source").path("durationSec").asDouble()).append(" 秒；原声：")
                        .append("ready".equals(output.path("sourceAudio").path("status").asText())?"已提取，可用于合成":"不可用").append('\n');
                for(JsonNode segment:output.path("filmStudy").path("segments")) {
                    out.append("### 片段 ").append(segment.path("no").asInt()).append("（素材 ID=")
                            .append(StudioPlanExecutionIds.segmentNodeId(execution.getId(),stage,id,segment.path("no").asInt())).append("，")
                            .append(segment.path("startSec").asDouble()).append("–").append(segment.path("endSec").asDouble()).append(" 秒）\n");
                    String markdown=segment.path("markdown").asText("");
                    out.append(markdown.length()>3000?markdown.substring(0,3000)+"…":markdown).append('\n');
                }
            } else if(output.hasNonNull("text")) {
                String text=output.path("text").asText();
                out.append(text.length()>6000?text.substring(0,6000)+"…":text).append('\n');
            }
            if(out.length()>24000)break;
        }
        return out.length()>24000?out.substring(0,24000):out.toString();
    }

    /** Resolve a plan binding node id: an output of this execution, else an owned canvas media node. */
    public String resolveNodeKey(IpPlanExecution execution,JsonNode steps,JsonNode doc,String nodeId) {
        if(nodeId.startsWith(execution.getId()+"-")) {
            for(JsonNode node:outputNodes(execution,steps)) {
                if(!nodeId.equals(node.path("nodeId").asText()))continue;
                var dto=run(execution.getOwnerUserId(),execution.getProjectId(),node.path("runId").asText()).orElseThrow(StudioPlanOutputs::missing);
                if(node.has("segmentNo")) {
                    for(JsonNode segment:dto.output().path("filmStudy").path("segments"))
                        if(segment.path("no").asInt()==node.path("segmentNo").asInt()&&segment.hasNonNull("storageKey"))return segment.path("storageKey").asText();
                    throw missing();
                }
                String key=outputKey(dto,null);
                if(key==null)throw missing();
                return key;
            }
            throw missing();
        }
        JsonNode node=IpDocs.node(doc,nodeId);
        String key=node==null?null:IpDocs.primaryStorageKey(node);
        if(key==null)throw BusinessException.badRequest("STUDIO_CONTEXT_NOT_FOUND","计划引用的画布素材已不存在或还没有可用文件，请检查后重新规划");
        return projects.requireOwnedAssetKey(execution.getOwnerUserId(),key);
    }

    /** Extracted source audio of the analysis film study (status ready), for assemble with the original soundtrack. */
    public String sourceAudio(IpPlanExecution execution,JsonNode steps) {
        for(JsonNode step:steps) {
            if(!"recreation".equals(step.path("operation").asText())||!"done".equals(step.path("status").asText()))continue;
            String runId=chosenRun(execution.getOwnerUserId(),execution.getProjectId(),step).orElse(null);
            var dto=runId==null?null:run(execution.getOwnerUserId(),execution.getProjectId(),runId).orElse(null);
            if(dto!=null&&dto.output()!=null&&"ready".equals(dto.output().path("sourceAudio").path("status").asText()))
                return dto.output().path("sourceAudio").path("storageKey").asText(null);
        }
        return null;
    }

    static BusinessException missing() {
        return BusinessException.badRequest("STUDIO_PLAN_INPUT_MISSING","这一步需要的前置产物还没有可用结果，请检查前面的步骤");
    }
    public static boolean isRunning(IpRun run) {return IpRun.STATUS_RUNNING.equals(run.getStatus());}
}
