package com.aistareco.ops;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.*;
import org.springframework.scheduling.annotation.*;
import java.util.*;
import java.util.stream.Stream;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class DeploymentRuntimeTest {
    JdbcTemplate jdbc;DeploymentRuntime runtime;
    @BeforeEach void setup(){jdbc=mock(JdbcTemplate.class);when(jdbc.queryForObject(anyString(),eq(Long.class))).thenReturn(0L);ObjectProvider<ScheduledAnnotationBeanPostProcessor> provider=mock(ObjectProvider.class);when(provider.orderedStream()).thenAnswer(x->Stream.empty());runtime=new DeploymentRuntime(provider,Map.of(),Map.of(),jdbc);}
    @Test void acceptedRequestsPreventDrainUntilTheyFinish(){runtime.entered();assertTrue(runtime.quiesce());assertFalse((Boolean)runtime.status().get("drained"));runtime.exited();assertTrue((Boolean)runtime.status().get("drained"));assertFalse(runtime.quiesce());}
    @Test void vendorOrPersistentWorkPreventsDrain(){when(jdbc.queryForObject(contains("material_video_job"),eq(Long.class))).thenReturn(1L);runtime.quiesce();assertFalse((Boolean)runtime.status().get("drained"));}
    @Test void missingOrRemoteTokenCannotStopClaims(){var controller=new DeploymentController(runtime,"x".repeat(32));var request=new MockHttpServletRequest();request.setRemoteAddr("10.20.2.195");request.addHeader("X-Aistar-Deployment-Token","x".repeat(32));assertEquals(403,controller.quiesce(request).getStatusCode().value());assertFalse((Boolean)runtime.status().get("quiescing"));request.setRemoteAddr("127.0.0.1");request.removeHeader("X-Aistar-Deployment-Token");assertEquals(403,controller.quiesce(request).getStatusCode().value());}
    @Test void loopbackPlusStrongTokenCanDrainAndDatabaseFailureStaysClosed(){var controller=new DeploymentController(runtime,"x".repeat(32));var request=new MockHttpServletRequest();request.setRemoteAddr("127.0.0.1");request.addHeader("X-Aistar-Deployment-Token","x".repeat(32));assertEquals(200,controller.quiesce(request).getStatusCode().value());when(jdbc.queryForObject(anyString(),eq(Long.class))).thenThrow(new IllegalStateException("private database error"));var result=controller.status(request);assertEquals(503,result.getStatusCode().value());assertEquals(false,result.getBody().get("drained"));assertFalse(result.toString().contains("private database error"));}
    @Test void asyncRequestsRemainCountedUntilCompletion()throws Exception {var filter=new DeploymentRequestFilter(runtime);var request=new MockHttpServletRequest();request.setAsyncSupported(true);request.setRequestURI("/api/stream");var response=new MockHttpServletResponse();filter.doFilter(request,response,(req,res)->req.startAsync(req,res));runtime.quiesce();assertEquals(1,runtime.status().get("in_flight"));((MockAsyncContext)request.getAsyncContext()).complete();assertEquals(0,runtime.status().get("in_flight"));}
    @Test void failedSynchronousRequestReleasesItsSlot(){var filter=new DeploymentRequestFilter(runtime);var request=new MockHttpServletRequest();request.setRequestURI("/api/task");assertThrows(jakarta.servlet.ServletException.class,()->filter.doFilter(request,new MockHttpServletResponse(),(req,res)->{throw new jakarta.servlet.ServletException("synthetic");}));assertEquals(0,runtime.status().get("in_flight"));}
}
