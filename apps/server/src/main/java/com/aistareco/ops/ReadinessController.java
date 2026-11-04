package com.aistareco.ops;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import javax.sql.DataSource;
import java.util.Map;

/** ALB checks application startup completion and its real database connection. */
@RestController
public class ReadinessController {
    private final DataSource dataSource;
    private com.aistareco.aep.service.sms.TairSmsCodeStore sms;
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    public void setSmsStore(com.aistareco.aep.service.sms.TairSmsCodeStore sms){this.sms=sms;}
    private volatile boolean started;
    public ReadinessController(DataSource dataSource) { this.dataSource=dataSource; }
    @EventListener(ApplicationReadyEvent.class) public void markReady() { started=true; }
    @EventListener(ContextClosedEvent.class) public void markStopping() { started=false; }
    @GetMapping("/internal/ready")
    public ResponseEntity<Map<String,Boolean>> ready() {
        boolean valid=false;
        if(started)try(var connection=dataSource.getConnection()) { valid=connection.isValid(1); }
        catch(java.sql.SQLException ignored) { /* No connection details or credentials in the health response. */ }
        if(valid && sms!=null)valid=sms.ready();
        return ResponseEntity.status(valid?200:503).cacheControl(CacheControl.noStore()).body(Map.of("ready",valid));
    }
}
