package com.aistareco.aep.ipstudio;
import com.aistareco.aep.ipstudio.controller.StudioConversationShareController;
import com.aistareco.aep.ipstudio.service.StudioConversationShareService;
import com.aistareco.aep.enrollment.config.ProductRouteTable;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StudioConversationShareControllerTest {
 @Test void onlyExactPublicReadIsExemptAndNoPublicManagementIsAllowed() {
  var path="/api/v1/ip-studio/shared/conversations/abc";
  assertTrue(ProductRouteTable.isPublicGet(path,"GET"));assertFalse(ProductRouteTable.isPublicGet(path,"POST"));assertFalse(ProductRouteTable.isPublicGet(path+"/copy","GET"));
  var service=mock(StudioConversationShareService.class);var c=new StudioConversationShareController(service);
  assertThrows(BusinessException.class,()->c.preview(null,"p","n"));assertThrows(BusinessException.class,()->c.create(null,"p","n",null));assertThrows(BusinessException.class,()->c.revoke(null,"p","n","t"));assertThrows(BusinessException.class,()->c.copy(null,"t",null));verifyNoInteractions(service);
 }
 @Test void publicViewIsUncachedAndNoIndex() {
  var service=mock(StudioConversationShareService.class);when(service.read("t")).thenReturn(new StudioConversationShareService.PublicView(new ObjectMapper().createObjectNode(),Instant.now()));
  var response=new StudioConversationShareController(service).read("t");assertEquals("no-store",response.getHeaders().getCacheControl());assertEquals("noindex, nofollow",response.getHeaders().getFirst("X-Robots-Tag"));
 }
}
