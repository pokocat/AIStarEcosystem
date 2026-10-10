package com.aistareco.aep.service;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;

/** Endpoint row lock serializes admission across processes; waiting never occupies a worker. */
@Service
public class AiGenerationQueueService {
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
    public static final String IMAGE="ip-image",WORKFLOW="ip-workflow",SPEECH="ip-speech",VIDEO="material-video";
    public static final String SYNC="sync-call";
    private final ThreadLocal<String> ownedEndpoint=new ThreadLocal<>();
    public enum Admission { READY, WAITING, BUSY }
    private final AiModelEndpointRepository endpoints;
    private final AiAppBindingRepository bindings;
    private final AiGenerationQueueRepository entries;
    private final TransactionTemplate tx;
    public AiGenerationQueueService(AiModelEndpointRepository endpoints,AiAppBindingRepository bindings,
            AiGenerationQueueRepository entries,PlatformTransactionManager manager) {
        this.endpoints=endpoints;this.bindings=bindings;this.entries=entries;
        tx=new TransactionTemplate(manager);tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    public String endpointFor(AiModelPurpose purpose,String selected) {
        if(selected!=null&&!selected.isBlank())return selected;
        return bindings.findById(purpose).map(AiAppBinding::getEndpointId).orElse(null);
    }
    /** Discover committed jobs left in executor memory at shutdown; never grant or execute here. */
    public void register(String type,String id,String endpointId,boolean alreadyExecuting) {
        if(endpointId==null)return;
        tx.executeWithoutResult(s->{
            if(endpoints.lockById(endpointId).isEmpty()||entries.findByTaskTypeAndTaskId(type,id).isPresent())return;
            var entry=new AiGenerationQueueEntry();entry.setEndpointId(endpointId);entry.setTaskType(type);entry.setTaskId(id);
            entry.setState(alreadyExecuting?"running":"waiting");entry.setCreatedAt(Instant.now());entry.setDispatchAfter(Instant.now());entries.save(entry);
        });
    }
    public Admission acquire(String type,String taskId,String endpointId,boolean retainAcrossSteps) {
        endpointId=entries.findByTaskTypeAndTaskId(type,taskId).map(AiGenerationQueueEntry::getEndpointId).orElse(endpointId);
        if(endpointId==null)return Admission.READY; // unconfigured engine still follows its existing failure path
        final String scope=endpointId;
        return tx.execute(s->{
            var endpoint=endpoints.lockById(scope).orElse(null);
            if(endpoint==null)return Admission.READY;
            var entry=entries.findByTaskTypeAndTaskId(type,taskId).orElse(null);
            if(entry==null) {
                entry=new AiGenerationQueueEntry();entry.setEndpointId(scope);entry.setTaskType(type);entry.setTaskId(taskId);
                entry.setState("waiting");entry.setCreatedAt(Instant.now());entry.setDispatchAfter(Instant.now().plusSeconds(SYNC.equals(type)?180:0));entries.saveAndFlush(entry);
            }
            if("finished".equals(entry.getState()))return Admission.BUSY;
            if("running".equals(entry.getState()))return retainAcrossSteps?Admission.READY:Admission.BUSY;
            int limit=endpoint.getConcurrencyLimit()==null?0:endpoint.getConcurrencyLimit();
            long running=entries.countByEndpointIdAndState(scope,"running");
            long ahead=entries.countByEndpointIdAndStateAndIdLessThan(scope,"waiting",entry.getId());
            if(limit>0 && running+ahead>=limit)return Admission.WAITING;
            entry.setState("running");entry.setDispatchAfter(Instant.now().plusSeconds(180));entries.save(entry);
            return Admission.READY;
        });
    }
    public void finish(String type,String id) {mutate(type,id,e->e.setState("finished"));}
    public void touch(String type,String id) {mutate(type,id,e->e.setDispatchAfter(Instant.now().plusSeconds(180)));}
    private void mutate(String type,String id,java.util.function.Consumer<AiGenerationQueueEntry> change) {
        tx.executeWithoutResult(s->{
            var snapshot=entries.findByTaskTypeAndTaskId(type,id).orElse(null);if(snapshot==null)return;
            endpoints.lockById(snapshot.getEndpointId());
            var entry=entries.findById(snapshot.getId()).orElseThrow();entityManager.refresh(entry);change.accept(entry);entries.save(entry);
        });
    }
    /** Atomic dispatch lease prevents repeated @Async submissions while a pool is busy. */
    public boolean claimDispatch(AiGenerationQueueEntry snapshot,boolean recovery) {
        return Boolean.TRUE.equals(tx.execute(s->{
            var endpoint=endpoints.lockById(snapshot.getEndpointId()).orElse(null);if(endpoint==null)return false;
            var entry=entries.findById(snapshot.getId()).orElseThrow();
            if(!entry.getState().equals(recovery?"running":"waiting")||entry.getDispatchAfter().isAfter(Instant.now()))return false;
            if(!recovery) {
                int limit=endpoint.getConcurrencyLimit()==null?0:endpoint.getConcurrencyLimit();
                if(limit>0&&entries.countByEndpointIdAndState(endpoint.getId(),"running")+
                        entries.countByEndpointIdAndStateAndIdLessThan(endpoint.getId(),"waiting",entry.getId())>=limit)return false;
            }
            entry.setDispatchAfter(Instant.now().plusSeconds(recovery?180:30));entries.save(entry);return true;
        }));
    }
    public List<AiGenerationQueueEntry> openEntries(){return entries.findByStateInOrderByIdAsc(List.of("waiting","running"));}
    public void expireSynchronous(AiGenerationQueueEntry snapshot) {
        mutate(snapshot.getTaskType(),snapshot.getTaskId(),e->{if(e.getDispatchAfter().isBefore(Instant.now()))e.setState("finished");});
    }
    public boolean isWaiting(String type,String id){return entries.findByTaskTypeAndTaskId(type,id).filter(e->"waiting".equals(e.getState())).isPresent();}
    /** Serialize a short read with admission/release so each reported position is a consistent snapshot. */
    public com.aistareco.aep.dto.AiGenerationQueuePositionDto position(String type,String id) {
        var snapshot=entries.findByTaskTypeAndTaskId(type,id).orElse(null);
        if(snapshot==null||!"waiting".equals(snapshot.getState()))return null;
        return tx.execute(s->{
            var endpoint=endpoints.lockById(snapshot.getEndpointId()).orElse(null);if(endpoint==null)return null;
            var entry=entries.findById(snapshot.getId()).orElse(null);
            if(entry==null||!"waiting".equals(entry.getState()))return null;
            return new com.aistareco.aep.dto.AiGenerationQueuePositionDto(
                entries.countByEndpointIdAndStateAndIdLessThan(endpoint.getId(),"waiting",entry.getId())+1,
                entries.countByEndpointIdAndState(endpoint.getId(),"waiting"),
                entries.countByEndpointIdAndState(endpoint.getId(),"running"),endpoint.getConcurrencyLimit());
        });
    }
    public String pinnedEndpoint(String type,String id){return entries.findByTaskTypeAndTaskId(type,id).map(AiGenerationQueueEntry::getEndpointId).orElse(null);}
    /** A Studio worker already owns a slot; its nested HTTP call must not acquire a second one. */
    public Scope bind(String type,String id) {
        String previous=ownedEndpoint.get();ownedEndpoint.set(pinnedEndpoint(type,id));
        return ()->{if(previous==null)ownedEndpoint.remove();else ownedEndpoint.set(previous);};
    }
    public interface Scope extends AutoCloseable { @Override void close(); }
    public <T> T synchronous(String endpointId,java.time.Duration httpTimeout,java.util.function.Supplier<T> call) {
        if(endpointId==null||endpointId.equals(ownedEndpoint.get()))return call.get();
        String id="call-"+UUID.randomUUID();long until=System.nanoTime()+java.time.Duration.ofMinutes(15).toNanos();
        try {
            while(acquire(SYNC,id,endpointId,false)!=Admission.READY) {
                touch(SYNC,id);
                if(System.nanoTime()>until)throw new com.aistareco.common.BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "GENERATION_QUEUE_TIMEOUT","排队等待较久，请稍后再试");
                try {Thread.sleep(500);}catch(InterruptedException error) {
                    Thread.currentThread().interrupt();throw new com.aistareco.common.BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                        "GENERATION_QUEUE_INTERRUPTED","排队已停止，请稍后再试");
                }
            }
            // HTTP timeouts include vendor processing; a crash leaves a conservative reservation until then.
            mutate(SYNC,id,e->e.setDispatchAfter(Instant.now().plus(httpTimeout).plusSeconds(60)));
            try(var context=bind(SYNC,id)){return call.get();}
        } finally {finish(SYNC,id);}
    }
}
