package com.aistareco.aep.card.service;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.*;
import com.aistareco.aep.dto.PromptParamsDto;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class CardPersonaContextTest {
 @Test void rewriteReceivesUserFactsEvenWithOldSystemOnlyPlaceholders() {
  var models=mock(AiModelInvocationService.class);var prompts=mock(PromptService.class);
  when(models.hasEndpointFor(AiModelPurpose.DAP_PERSONA,"aiavatar")).thenReturn(true);
  when(prompts.resolve("card.persona_rewrite")).thenReturn(new PromptService.ResolvedPrompt("规则与 {{persona}} 占位", "按上面改写",new PromptParamsDto(null,1536,true),"resource"));
  when(models.invokeChat(eq(AiModelPurpose.DAP_PERSONA),any(),any(),eq("aiavatar"))).thenReturn(new AiModelInvocationService.AiModelResponse("{\"headline\":\"产品原型设计\",\"give\":[\"原型\"],\"want\":[\"合作\"]}","stop",10L,"formal","qwen38"));
  new CardPersonaService(models,prompts).rewrite(Map.of("persona","务实简洁","title","产品设计师","headline","做产品设计","give",List.of("原型设计"),"want",List.of("合作项目")));
  var messages=org.mockito.ArgumentCaptor.forClass(List.class);verify(models).invokeChat(eq(AiModelPurpose.DAP_PERSONA),messages.capture(),any(),eq("aiavatar"));
  var system=(Map<?,?>)messages.getValue().get(0);var user=(Map<?,?>)messages.getValue().get(1);
  assertFalse(system.get("content").toString().contains("产品设计师"));
  assertTrue(user.get("content").toString().contains("产品设计师"));assertTrue(user.get("content").toString().contains("原型设计"));
 }
}
