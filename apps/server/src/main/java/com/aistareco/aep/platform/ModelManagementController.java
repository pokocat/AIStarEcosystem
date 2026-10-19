package com.aistareco.aep.platform;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/service/model-management/v1")
public class ModelManagementController {
 private final ModelManagementIdentity identity;
 private final ModelManagementService service;
 private final ObjectMapper mapper;
 private final ModelOperationsService operations;
 public ModelManagementController(ModelManagementIdentity identity,ModelManagementService service,ObjectMapper mapper,ModelOperationsService operations) {this.identity=identity;this.service=service;this.mapper=mapper;this.operations=operations;}
 public record CommandBody(String commandJson) {}
 @PostMapping("/command")
 public ApiResponse<Object> command(@RequestHeader(value="Authorization",required=false) String authorization,@RequestBody CommandBody body) {
  if(body==null||body.commandJson()==null||body.commandJson().length()>250000) throw new BusinessException(HttpStatus.BAD_REQUEST,"MODEL_MANAGEMENT_COMMAND_INVALID","配置内容无效");
  try {
   var cmd=mapper.readTree(body.commandJson());
   if(!cmd.isObject()||!cmd.path("action").isTextual()) throw new IllegalArgumentException();
   var actor=identity.require(authorization,body.commandJson(),cmd.path("action").asText());
   return ApiResponse.of(ModelOperationsService.handles(cmd.path("action").asText()) ? operations.execute(cmd) : service.execute(cmd,actor.getSubject()));
  } catch(BusinessException | org.springframework.web.server.ResponseStatusException e) {throw e;} catch(Exception e) {throw new BusinessException(HttpStatus.BAD_REQUEST,"MODEL_MANAGEMENT_COMMAND_INVALID","配置内容无效");}
 }
}
