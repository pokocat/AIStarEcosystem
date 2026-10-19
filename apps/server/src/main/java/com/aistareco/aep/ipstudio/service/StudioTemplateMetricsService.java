package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Owner-only version cohort; all costs/results derive from original jobs, never a second settlement store. */
@Service
public class StudioTemplateMetricsService {
    private final IpProjectRepository repo;private final IpProjectService projects;
    private final StudioTemplateService templates;private final StudioTemplateExecutionService execution;
    public StudioTemplateMetricsService(IpProjectRepository repo,IpProjectService projects,StudioTemplateService templates,StudioTemplateExecutionService execution){this.repo=repo;this.projects=projects;this.templates=templates;this.execution=execution;}
    @Transactional(readOnly=true)
    public Metrics read(String owner,String versionId) {
        var instances=repo.findByOwnerUserIdAndTemplateVersionIdAndDeletedAtIsNull(owner,versionId);
        // A downlisted release remains readable through an owned instance, including its historical costs.
        var version=instances.isEmpty()?templates.read(owner,versionId):templates.instance(owner,instances.get(0).getId()).source();
        int completed=0,generated=0,accepted=0,firstPass=0,failed=0,running=0,packages=0,archived=0;long spent=0,pending=0;
        for(var p:instances) {
            var state=execution.read(owner,p.getId());var snapshot=projects.parseOrEmptyObject(p.getTemplateInstanceJson());
            var attempts=new HashMap<String,Integer>();Set<String> jobIds=new HashSet<>();
            for(var request:snapshot.path("templateRequests")) {
                String id=request.path("runId").asText();if(!jobIds.add(id))continue;
                String step=request.path("stepId").asText();attempts.merge(step,1,Integer::sum);
                var r=projects.toRunDto(projects.ownedRun(owner,p.getId(),id).orElseThrow());
                if("running".equals(r.status())){running++;pending+=r.cost();}else{spent+=r.cost();if("failed".equals(r.status()))failed++;}
            }
            for(var s:state.steps()) {
                if(s.run()!=null&&"done".equals(s.run().status()))generated++;
                if(s.accepted()&&"done".equals(s.status())){accepted++;if(attempts.getOrDefault(s.id(),0)==1)firstPass++;}
                if(s.adoption()!=null&&s.accepted()&&"done".equals(s.status()))archived++;
            }
            if(state.steps().stream().allMatch(s->s.accepted()&&"done".equals(s.status())))completed++;
            packages+=snapshot.path("packages").size();
        }
        return new Metrics(versionId,version.version(),"owner",instances.size(),completed,generated,accepted,firstPass,failed,running,spent,pending,packages,archived);
    }
}
