package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.test.util.ReflectionTestUtils;
import java.net.InetSocketAddress;
import java.util.LinkedHashMap;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Reuses the executor's mocked repository/transaction fixture against exact production class files. No Spring/DB/provider. */
public final class PaymentProbe {
    private static StudioPlanExecutorTest fixture() {
        var f=new StudioPlanExecutorTest();f.setUp();return f;
    }
    private static void realRefusal(StudioPlanExecutorTest f,HttpStatus status,boolean secondOnly) {
        ReflectionTestUtils.setField(f.workflow,"projects",f.projects);
        when(f.projects.requiredForUpdate("u","p")).thenThrow(new ResponseStatusException(status,
                "积分余额不足，本次操作需 320，当前可用 16"));
        doAnswer(i->{
            RunRequest request=i.getArgument(2);f.submitted.add(request);
            if(!secondOnly||request.nodeId().endsWith("v2"))return i.callRealMethod();
            String id="IPR-"+request.nodeId();
            f.byRequest.put(request.clientRequestId(),IpRun.builder().id(id).ownerUserId("u").projectId("p").build());
            var dto=f.dto(id,"running",0,null);f.dtos.put(id,dto);return dto;
        }).when(f.workflow).submit(eq("u"),eq("p"),any());
    }
    private static Map<String,Object> probe(String name) throws Exception {
        var f=fixture();
        Map<String,Object> out=new LinkedHashMap<>();out.put("pid",ProcessHandle.current().pid());
        if("regression".equals(name)) {
            f.unknownSubmitOutcomeIsLookedUpBeforeAnyResubmission();
            var f2=fixture();f2.budgetExactlyEnoughSubmitsAndRepeatedWakesNeverDoubleSubmit();
            var f3=fixture();f3.failedChecksAndRejectionsStopForTheUser();
            out.put("unknownAccepted",true);out.put("normalAndBusinessRejection",true);return out;
        }
        boolean mixed="mixed".equals(name),unknown="unknown".equals(name),direct="direct".equals(name),preempt="preempt".equals(name);
        if(mixed)f.execution("running",1000,f.videoStep("v1",40),f.videoStep("v2",320));
        else f.execution("running",1000,f.videoStep("v1",320));
        realRefusal(f,unknown?HttpStatus.BAD_GATEWAY:HttpStatus.PAYMENT_REQUIRED,mixed);
        if(direct) {
            assertThrows(ResponseStatusException.class,()->f.workflow.submit("u","p",null));
            out.put("directUntouched",true);return out;
        }
        if(preempt) {
            doAnswer(i->{
                f.row.setLeaseVersion(f.row.getLeaseVersion()+1);f.row.setLeaseOwner(null);
                throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,"积分余额不足，本次操作需 320，当前可用 16");
            }).when(f.projects).requiredForUpdate("u","p");
        }
        f.executor.advance("PEX-1");
        out.put("status",f.row.getStatus());out.put("inFlight",f.row.getInFlight());
        out.put("stepStatus",f.step(mixed?"v2":"v1").path("status").asText());
        out.put("code",f.step(mixed?"v2":"v1").path("errorCode").asText());
        out.put("reason",f.state().path("needsUserReason").asText());out.put("budget",f.budget().path("inFlight").asLong());
        if(!unknown&&!preempt) {
            f.executor.advance("PEX-1");f.executor.advance("PEX-1");out.put("submissions",f.submitted.size());
            if("needs_user".equals(out.get("status"))) {
                assertEquals(mixed?40L:0L,out.get("inFlight"));assertEquals(out.get("inFlight"),out.get("budget"));
                assertEquals("STUDIO_PAYMENT_REQUIRED",out.get("code"));assertEquals(mixed?2:1,f.submitted.size());
                assertFalse(f.step(mixed?"v2":"v1").has("pendingRequestId"));assertTrue(f.posted.isEmpty());
                assertTrue(f.published.contains("budget.update"));
                assertTrue(out.get("reason").toString().contains("未扣积分"));
            }
        }
        verifyNoInteractions(f.runs);return out;
    }
    public static void main(String[] args) throws Exception {
        fixture(); // load exact application classes before Sandbox attaches
        var mapper=new ObjectMapper();var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/health",e->{byte[] b="ok".getBytes();e.sendResponseHeaders(200,b.length);e.getResponseBody().write(b);e.close();});
        server.createContext("/probe",e->{
            int status=200;Map<String,Object> result;
            try {result=probe(e.getRequestURI().getRawQuery());}
            catch(Throwable failure){status=500;result=Map.of("error",failure.toString());failure.printStackTrace();}
            byte[] b=mapper.writeValueAsBytes(result);e.sendResponseHeaders(status,b.length);e.getResponseBody().write(b);e.close();
        });
        server.start();System.out.println("READY "+server.getAddress().getPort()+" "+ProcessHandle.current().pid());System.out.flush();
        System.in.read();server.stop(0);
    }
}
