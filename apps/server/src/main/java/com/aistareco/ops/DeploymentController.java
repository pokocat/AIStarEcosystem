package com.aistareco.ops;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/** Nginx must deny this path; a strong per-cluster token is additionally required. */
@RestController
@RequestMapping("/internal/deployment")
public class DeploymentController {
    private final DeploymentRuntime runtime;private final String token;
    public DeploymentController(DeploymentRuntime runtime,@Value("${aep.deployment.token:${AEP_DEPLOYMENT_TOKEN:}}")String token){this.runtime=runtime;this.token=token;}
    private boolean allowed(HttpServletRequest request) {
        String remote=request.getRemoteAddr(),given=request.getHeader("X-Aistar-Deployment-Token");
        return ("127.0.0.1".equals(remote)||"::1".equals(remote)||"0:0:0:0:0:0:0:1".equals(remote))&&token.length()>=32&&given!=null&&MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8),given.getBytes(StandardCharsets.UTF_8));
    }
    @GetMapping public ResponseEntity<Map<String,Object>> status(HttpServletRequest request){return answer(request,false);}
    @PostMapping public ResponseEntity<Map<String,Object>> quiesce(HttpServletRequest request){return answer(request,true);}
    private ResponseEntity<Map<String,Object>> answer(HttpServletRequest request,boolean stop) {
        if(!allowed(request))return ResponseEntity.status(403).cacheControl(CacheControl.noStore()).body(Map.of("error","forbidden"));
        if(stop)runtime.quiesce();
        try{return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(runtime.status());}
        catch(RuntimeException unavailable){return ResponseEntity.status(503).cacheControl(CacheControl.noStore()).body(Map.of("error","drain evidence unavailable","drained",false));}
    }
}
