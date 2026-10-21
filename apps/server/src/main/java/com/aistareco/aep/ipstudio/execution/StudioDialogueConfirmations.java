package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dialogue.IpDialogueMessage;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueMessageRepository;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueThreadRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Read-only bridge to the dialogue's stored messages (owned by the dialogue side): plan blocks proposed inside a parent
 * dialogue run. Approval cards are validated by the dialogue itself ({@code StudioDialogueApprovals}), the single rule
 * for which card can confirm which plan revision.
 */
@Component
public class StudioDialogueConfirmations implements StudioPlanSource {
    private static final int RECENT=200;
    private final ObjectProvider<IpDialogueMessageRepository> messages;
    private final ObjectProvider<IpDialogueThreadRepository> threads;
    private final IpProjectService projects;
    private final ObjectMapper mapper;
    public StudioDialogueConfirmations(ObjectProvider<IpDialogueMessageRepository> messages,ObjectProvider<IpDialogueThreadRepository> threads,
            IpProjectService projects,ObjectMapper mapper) {
        this.messages=messages;this.threads=threads;this.projects=projects;this.mapper=mapper;
    }

    /** A plan block on the assistant message of an owned parent dialogue run, with the skill snapshot that run carried. */
    @Override
    public Optional<PlanRecord> find(String userId,String projectId,String planRunId,String fingerprint) {
        var repository=messages.getIfAvailable();
        if(repository==null)return Optional.empty();
        var run=projects.ownedRun(userId,projectId,planRunId).orElse(null);
        if(run==null)return Optional.empty();
        JsonNode input=PlanState.parse(mapper,run.getInputJson());
        String threadId=input.path("dialogue").path("threadId").asText(null),assistantId=input.path("_exec").path("assistantMessageId").asText(null);
        if(threadId==null||assistantId==null||!input.path("_exec").path("skill").isObject())return Optional.empty();
        var message=repository.findById(assistantId).filter(m->threadId.equals(m.getThreadId())).orElse(null);
        if(message==null)return Optional.empty();
        for(JsonNode block:blocks(message)) {
            if(!"plan".equals(block.path("type").asText())||!planRunId.equals(block.path("planRunId").asText())||!fingerprint.equals(block.path("fingerprint").asText()))continue;
            // The turn's own attachments plus the canvas nodes the plan names (attached in an earlier turn, still referenced).
            LinkedHashSet<String> refs=new LinkedHashSet<>();input.path("contextNodeIds").forEach(v->refs.add(v.asText()));
            for(JsonNode step:block.path("plan").path("steps"))PlanState.canvasRefs(step,refs);
            List<String> context=new ArrayList<>(refs);
            return Optional.of(new PlanRecord(planRunId,block.path("plan"),input.path("_exec").path("skill"),context,block.path("revision").asInt(1),threadId,assistantId));
        }
        return Optional.empty();
    }

    /** Objects the finished create_nodes calls of the conversation's latest {@value #RECENT} messages put on the canvas. */
    @Override
    public Set<String> assistantNodeIds(String threadId) {
        var repository=messages.getIfAvailable();
        if(repository==null||threadId==null)return null;
        Set<String> out=new LinkedHashSet<>();
        for(var message:repository.findByThreadIdOrderBySeqDesc(threadId,org.springframework.data.domain.PageRequest.of(0,RECENT)))
            for(JsonNode block:blocks(message)) {
                if(!"tool_call".equals(block.path("type").asText())||!"create_nodes".equals(block.path("toolName").asText())||!"done".equals(block.path("status").asText()))continue;
                block.path("result").path("nodeIds").forEach(id->{if(id.isTextual())out.add(id.asText());});
            }
        return out;
    }

    private List<JsonNode> blocks(IpDialogueMessage message) {
        JsonNode blocks=PlanState.parse(mapper,"{\"b\":"+(message.getBlocksJson()==null||message.getBlocksJson().isBlank()?"[]":message.getBlocksJson())+"}").path("b");
        List<JsonNode> out=new ArrayList<>();if(blocks.isArray())blocks.forEach(out::add);return out;
    }
}
