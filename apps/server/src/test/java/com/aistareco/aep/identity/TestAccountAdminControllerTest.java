package com.aistareco.aep.identity;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class TestAccountAdminControllerTest {
 @Test void allEndpointsRequireSuperAdminAnnotation(){assertEquals("hasRole('SUPER_ADMIN')",TestAccountAdminController.class.getAnnotation(PreAuthorize.class).value());}
 @Test void staleOrNonAdminActorIsDeniedBeforeAnyIdentityCall(){
  var admins=mock(AdminUserRepository.class);var users=mock(AepUserRepository.class);when(admins.findById("actor")).thenReturn(Optional.empty());when(users.findById("actor")).thenReturn(Optional.empty());
  var c=new TestAccountAdminController(new IdentityProperties(),admins,users,mock(AuditService.class));
  var e=assertThrows(BusinessException.class,()->c.list(new UsernamePasswordAuthenticationToken("actor",null,List.of()),0,new MockHttpServletResponse()));assertEquals("TEST_ACCOUNT_FORBIDDEN",e.getCode());
 }
 @Test void missingIdentityConfigurationFailsExplicitlyAndCannotGenerateLocalTestUsers(){
  var admins=mock(AdminUserRepository.class);var users=mock(AepUserRepository.class);var admin=new AdminUser();admin.setStatus(AdminUser.AdminStatus.ACTIVE);admin.setRole(AdminUser.AdminRole.SUPER_ADMIN);when(admins.findById("actor")).thenReturn(Optional.of(admin));
  var c=new TestAccountAdminController(new IdentityProperties(),admins,users,mock(AuditService.class));
  var e=assertThrows(BusinessException.class,()->c.create(new UsernamePasswordAuthenticationToken("actor",null,List.of()),new TestAccountAdminController.Create("测试"),new MockHttpServletRequest(),new MockHttpServletResponse()));assertEquals("TEST_ACCOUNT_UNAVAILABLE",e.getCode());verifyNoInteractions(users);
 }
}
