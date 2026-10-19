package com.aistareco.aep.identity;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.util.LinkedMultiValueMap;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** 测试身份由账号中心创建，产品后台只承担超管校验、代理和持久审计。 */
@RestController @RequestMapping("/api/admin/test-accounts") @PreAuthorize("hasRole('SUPER_ADMIN')")
public class TestAccountAdminController {
    private final IdentityProperties props;private final AdminUserRepository admins;private final AepUserRepository users;private final AuditService audit;
    private final RestClient http=RestClient.builder().requestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(5)).build())).build();
    public TestAccountAdminController(IdentityProperties props,AdminUserRepository admins,AepUserRepository users,AuditService audit){this.props=props;this.admins=admins;this.users=users;this.audit=audit;}
    public record Create(String displayName) {}
    @GetMapping public ApiResponse<JsonNode> list(Authentication auth,@RequestParam(defaultValue="0")int page,HttpServletResponse response){requireAdmin(auth);headers(response);return ApiResponse.of(call("GET","?page="+Math.max(0,page),null));}
    @PostMapping public ApiResponse<JsonNode> create(Authentication auth,@RequestBody Create body,HttpServletRequest request,HttpServletResponse response){requireAdmin(auth);headers(response);var data=call("POST","",body);audit.recordAdminAction("admin.test-account.create","test_account",data.path("uid").asText(),"创建独立测试身份",request);return ApiResponse.of(data);}
    @PostMapping("/{uid}/login") public ApiResponse<JsonNode> login(Authentication auth,@PathVariable String uid,HttpServletRequest request,HttpServletResponse response){requireAdmin(auth);headers(response);uid(uid);var data=call("POST","/"+uid+"/login",Map.of("clientId","web-aiavatar"));audit.recordAdminAction("admin.test-account.login","test_account",uid,"生成两分钟一次性测试登录入口",request);return ApiResponse.of(data);}
    @PostMapping("/{uid}/suspend") public ApiResponse<JsonNode> suspend(Authentication auth,@PathVariable String uid,HttpServletRequest request,HttpServletResponse response){requireAdmin(auth);headers(response);uid(uid);var data=call("POST","/"+uid+"/suspend",Map.of());audit.recordAdminAction("admin.test-account.suspend","test_account",uid,"停用测试身份并撤销授权",request);return ApiResponse.of(data);}
    private void requireAdmin(Authentication auth) {
        String id=auth==null?null:auth.getName();
        boolean allowed=id!=null && (admins.findById(id).map(a->a.getStatus()==AdminUser.AdminStatus.ACTIVE && a.getRole()==AdminUser.AdminRole.SUPER_ADMIN).orElse(false) || users.findById(id).map(u->u.getStatus()==AepUser.UserStatus.ACTIVE && u.getOperatorRole()==AepUser.OperatorRole.SUPER_ADMIN).orElse(false));
        if(!allowed)throw new BusinessException(HttpStatus.FORBIDDEN,"TEST_ACCOUNT_FORBIDDEN","仅有效的超级管理员可管理测试账号");
    }
    private JsonNode call(String method,String path,Object body) {
        if(!props.isAdminCallEnabled())throw unavailable();
        try {
            var form=new LinkedMultiValueMap<String,String>();form.add("grant_type","client_credentials");form.add("scope","admin.users");
            String basic=Base64.getEncoder().encodeToString((props.getAdminClientId()+":"+props.getAdminClientSecret()).getBytes(StandardCharsets.UTF_8));
            var token=http.post().uri(props.baseUrl()+"/oauth2/token").header("Authorization","Basic "+basic).contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(JsonNode.class);
            if(token==null || !token.path("access_token").isTextual())throw unavailable();
            var req=http.method(HttpMethod.valueOf(method)).uri(props.baseUrl()+"/api/admin/test-accounts"+path).header("Authorization","Bearer "+token.path("access_token").asText());
            if(body!=null)req.contentType(MediaType.APPLICATION_JSON).body(body);
            JsonNode result=req.retrieve().body(JsonNode.class);
            if(result==null || !result.path("success").asBoolean() || result.path("data").isMissingNode())throw unavailable();
            return result.path("data");
        } catch(org.springframework.web.client.RestClientResponseException e) {
            if(e.getStatusCode().is4xxClientError())throw new BusinessException(HttpStatus.BAD_REQUEST,"TEST_ACCOUNT_REQUEST_FAILED","测试账号操作未完成，请确认账号状态和后台授权后重试");
            throw unavailable();
        } catch(BusinessException e){throw e;} catch(RuntimeException e){throw unavailable();}
    }
    private static void uid(String uid){if(uid==null || !uid.matches("TEST_[0-9A-HJKMNP-TV-Z]{26}"))throw new BusinessException(HttpStatus.NOT_FOUND,"TEST_ACCOUNT_NOT_FOUND","测试账号不存在");}
    private static BusinessException unavailable(){return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"TEST_ACCOUNT_UNAVAILABLE","无法连接账号中心的测试账号服务，请检查后台身份配置后重试");}
    private static void headers(HttpServletResponse r){r.setHeader("Cache-Control","no-store");r.setHeader("Referrer-Policy","no-referrer");}
}
