package com.aistareco.aep.platform;
import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.repository.AuditLogRepository;
import com.aistareco.aep.service.AepUserService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class UserManagementServiceTest {
 private final AepUserService users=mock(AepUserService.class);
 private final AuditLogRepository audit=mock(AuditLogRepository.class);
 private final ObjectMapper mapper=new ObjectMapper();
 private final UserManagementService service=new UserManagementService(users,audit,mapper);
 private static AepUserDto user(String status){return new AepUserDto("u","fixture",null,null,"Fixture",null,null,null,"personal",status,null,List.of(),false,false,false,"zh-CN",Instant.now(),null,null);}
 @Test void reusesOriginalFilteredPaging() throws Exception {
  when(users.list(eq(AepUser.UserStatus.ACTIVE),eq(AepUser.AccountKind.PERSONAL),any(Pageable.class),eq("hello"))).thenReturn(Page.empty());
  service.execute(mapper.readTree("{\"action\":\"users\",\"page\":2,\"size\":20,\"q\":\"hello\",\"status\":\"active\",\"kind\":\"personal\"}"),"operator");
  var paging=ArgumentCaptor.forClass(Pageable.class);verify(users).list(eq(AepUser.UserStatus.ACTIVE),eq(AepUser.AccountKind.PERSONAL),paging.capture(),eq("hello"));assertEquals(2,paging.getValue().getPageNumber());verifyNoInteractions(audit);
 }
 @Test void statusChangeUsesOriginalServiceAndAuditsActorAndTransition() throws Exception {
  when(users.findById("u")).thenReturn(user("active"));when(users.suspend("u")).thenReturn(user("suspended"));
  service.execute(mapper.readTree("{\"action\":\"userSuspend\",\"id\":\"u\",\"reason\":\"test\"}"),"operator");
  verify(users).suspend("u");var log=ArgumentCaptor.forClass(AuditLog.class);verify(audit).save(log.capture());assertEquals("operator",log.getValue().getUserId());
  var detail=mapper.readTree(log.getValue().getDetail());assertEquals("active",detail.path("beforeStatus").asText());assertEquals("suspended",detail.path("afterStatus").asText());assertEquals("test",detail.path("reason").asText());
 }
 @Test void invalidWritesDoNotReachBusinessService(){
  assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"userSuspend\",\"id\":\"u\",\"reason\":\" \"}"),"operator"));
  assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"user\",\"id\":\"u\",\"operatorRole\":\"SUPER_ADMIN\"}"),"operator"));verifyNoInteractions(users,audit);
 }
}
