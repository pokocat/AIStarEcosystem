package com.aistareco.aep.platform;

import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/service/user-management/v1")
public class UserManagementController {
    private final ModelManagementIdentity identity;
    private final UserManagementService service;
    private final ObjectMapper mapper;
    public UserManagementController(ModelManagementIdentity identity, UserManagementService service, ObjectMapper mapper) {
        this.identity = identity; this.service = service; this.mapper = mapper;
    }
    @PostMapping("/command")
    public ApiResponse<Object> command(@RequestHeader(value = "Authorization", required = false) String authorization,
                                      @RequestBody ModelManagementController.CommandBody body) {
        if (body == null || body.commandJson() == null || body.commandJson().length() > 5000)
            throw BusinessException.badRequest("USER_MANAGEMENT_COMMAND_INVALID", "用户管理参数无效");
        try {
            var command = mapper.readTree(body.commandJson());
            if (!command.isObject() || !command.path("action").isTextual()) throw new IllegalArgumentException();
            var actor = identity.require(authorization, body.commandJson(), command.path("action").asText(), "aistar-user-management-v1");
            return ApiResponse.of(service.execute(command, actor.getSubject()));
        } catch (BusinessException | ResponseStatusException error) { throw error; }
        catch (Exception error) { throw BusinessException.badRequest("USER_MANAGEMENT_COMMAND_INVALID", "用户管理参数无效"); }
    }
}
