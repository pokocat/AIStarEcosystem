package com.aistareco.postgres;

import com.aistareco.ops.ReadinessController;
import org.junit.jupiter.api.Test;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ReadinessControllerTest {
    @Test void startupIsNotReadyEvenWhenDatabaseAcceptsConnections() throws Exception {
        var ds=mock(DataSource.class);var mvc=MockMvcBuilders.standaloneSetup(new ReadinessController(ds)).build();
        mvc.perform(get("/internal/ready")).andExpect(status().isServiceUnavailable()).andExpect(content().json("{\"ready\":false}"));verifyNoInteractions(ds);
    }
    @Test void readyChecksAndClosesRealConnection() throws Exception {
        var ds=mock(DataSource.class);var c=mock(Connection.class);when(ds.getConnection()).thenReturn(c);when(c.isValid(1)).thenReturn(true);
        var controller=new ReadinessController(ds);controller.markReady();var mvc=MockMvcBuilders.standaloneSetup(controller).build();
        mvc.perform(get("/internal/ready")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(content().json("{\"ready\":true}"));verify(c).close();
    }
    @Test void databaseFailureIs503WithoutDiagnostics() throws Exception {
        var ds=mock(DataSource.class);when(ds.getConnection()).thenThrow(new SQLException("password=private-diagnostic"));
        var controller=new ReadinessController(ds);controller.markReady();var mvc=MockMvcBuilders.standaloneSetup(controller).build();
        mvc.perform(get("/internal/ready")).andExpect(status().isServiceUnavailable()).andExpect(content().string("{\"ready\":false}"));
    }
    @Test void unavailableSharedSmsRemovesReadiness() throws Exception {
        var ds=mock(DataSource.class);var c=mock(Connection.class);when(ds.getConnection()).thenReturn(c);when(c.isValid(1)).thenReturn(true);
        var sms=mock(com.aistareco.aep.service.sms.TairSmsCodeStore.class);when(sms.ready()).thenReturn(false);
        var controller=new ReadinessController(ds);controller.setSmsStore(sms);controller.markReady();
        MockMvcBuilders.standaloneSetup(controller).build().perform(get("/internal/ready")).andExpect(status().isServiceUnavailable()).andExpect(content().json("{\"ready\":false}"));
    }
    @Test void shutdownRemovesReadinessBeforeAnotherDatabaseProbe() throws Exception {
        var ds=mock(DataSource.class);var controller=new ReadinessController(ds);controller.markReady();controller.markStopping();
        MockMvcBuilders.standaloneSetup(controller).build().perform(get("/internal/ready")).andExpect(status().isServiceUnavailable());verifyNoInteractions(ds);
    }
}
