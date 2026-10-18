package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.service.EnterpriseBillingService;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueMessage;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueMessageRepository;
import com.aistareco.aep.ipstudio.dialogue.IpDialogueThreadRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.*;

/**
 * Read-only bridge to the dialogue's stored messages (owned by the dialogue side): plan blocks proposed inside a parent
 * dialogue run, and the approval card / approving message a confirmation names. The server binds the confirmation to
 * the exact plan fingerprint; a model-written "用户已同意" or an old card can never authorize a new revision.
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

    /** True when the dialogue store exists in this deployment (otherwise confirmations are recorded without lookup). */
    public boolean available() {return messages.getIfAvailable()!=null&&threads.getIfAvailable()!=null;}

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
            List<String> context=new ArrayList<>();input.path("contextNodeIds").forEach(v->context.add(v.asText()));
            return Optional.of(new PlanRecord(planRunId,block.path("plan"),input.path("_exec").path("skill"),context,block.path("revision").asInt(1),threadId,assistantId));
        }
        return Optional.empty();
    }

    /**
     * The user's confirmation: the assistant message holding the approval card that was clicked, or a user message that
     * explicitly approved. The card must belong to this owner's project thread, name this stage and plan fingerprint
     * (and approvalId when given), be neither expired nor superseded, and carry the same payer.
     *
     * @return a copy of the matched approval block plus {@code threadId} and {@code messageId} (the card's message)
     */
    public com.fasterxml.jackson.databind.node.ObjectNode requireConfirmation(String userId,String projectId,String messageId,String stage,String planFingerprint,String approvalId,BillingSelection billing) {
        var messageRepository=messages.getIfAvailable();var threadRepository=threads.getIfAvailable();
        if(messageRepository==null||threadRepository==null)return null;
        var message=messageRepository.findById(messageId).orElseThrow(()->stale("找不到这条确认，请刷新后再确认"));
        var thread=threadRepository.findById(message.getThreadId())
                .filter(t->userId.equals(t.getOwnerUserId())&&projectId.equals(t.getProjectId())).orElseThrow(()->stale("这条确认不属于这张画布"));
        List<IpDialogueMessage> scope="assistant".equals(message.getRole())?List.of(message)
                :messageRepository.findByThreadIdOrderBySeqDesc(thread.getId(),PageRequest.of(0,RECENT));
        if(!"assistant".equals(message.getRole())&&!"user".equals(message.getRole()))throw stale("这条消息不能作为确认");
        for(var candidate:scope) {
            if(!"assistant".equals(candidate.getRole()))continue;
            for(JsonNode block:blocks(candidate)) {
                if(!"approval".equals(block.path("type").asText())||!planFingerprint.equals(block.path("planFingerprint").asText()))continue;
                if(!stage.equals(block.path("stage").asText()))continue;
                if(approvalId!=null&&!approvalId.equals(block.path("approvalId").asText()))continue;
                String status=block.path("status").asText("pending");
                if(Set.of("expired","superseded").contains(status))throw stale("这张确认卡已过期或被新方案替代，请看最新的方案后再确认");
                Instant expires=instant(block.path("expiresAt").asText(null));
                if(expires!=null&&expires.isBefore(Instant.now())&&!"approved".equals(status))throw stale("这张确认卡已过期，请重新确认");
                if(block.hasNonNull("billingSelection")) {
                    var card=EnterpriseBillingService.normalize(mapper.convertValue(block.path("billingSelection"),BillingSelection.class));
                    if(!card.equals(billing))throw new BusinessException(HttpStatus.CONFLICT,"BILLING_SELECTION_CONFLICT","付款账户与确认卡上的不一致，请重新确认");
                }
                var out=((com.fasterxml.jackson.databind.node.ObjectNode)block).deepCopy();
                out.put("threadId",thread.getId()).put("messageId",candidate.getId());
                return out;
            }
        }
        throw stale("这条确认对应的不是当前这份方案，请看最新的方案后再确认");
    }

    private List<JsonNode> blocks(IpDialogueMessage message) {
        JsonNode blocks=PlanState.parse(mapper,"{\"b\":"+(message.getBlocksJson()==null||message.getBlocksJson().isBlank()?"[]":message.getBlocksJson())+"}").path("b");
        List<JsonNode> out=new ArrayList<>();if(blocks.isArray())blocks.forEach(out::add);return out;
    }
    private static Instant instant(String value){try{return value==null?null:Instant.parse(value);}catch(RuntimeException e){return null;}}
    private static BusinessException stale(String message){return StudioPlanExecutionService.stale(message);}
}
