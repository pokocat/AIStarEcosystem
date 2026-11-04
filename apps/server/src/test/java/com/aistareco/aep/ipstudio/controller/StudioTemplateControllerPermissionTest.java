package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.Version;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.security.InAppOperatorGuard;
import com.aistareco.aep.service.ErrorLogService;
import com.aistareco.common.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** HTTP publication uses the persisted in-app role, including ordinary consumer tokens. */
class StudioTemplateControllerPermissionTest {
    private final AepUserRepository users = mock(AepUserRepository.class);
    private final StudioTemplateService templates = mock(StudioTemplateService.class);
    private final UsernamePasswordAuthenticationToken auth =
            new UsernamePasswordAuthenticationToken("author", "unused", List.of());
    private MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new StudioTemplateController(templates,
                new InAppOperatorGuard(users), mock(StudioTemplateExecutionService.class),
                mock(StudioTemplatePackageService.class), mock(StudioTemplateMetricsService.class)))
                .setControllerAdvice(new GlobalExceptionHandler(mock(ErrorLogService.class))).build();
        when(templates.publish(eq("author"), eq("project"), any())).thenReturn(
                new Version("version", "template", 1, "模板", "", "official", null,
                        new ObjectMapper().createObjectNode(), null));
    }

    private void user(AepUser.OperatorRole role, AepUser.UserStatus status) {
        when(users.findById("author")).thenReturn(Optional.of(AepUser.builder()
                .id("author").operatorRole(role).status(status).build()));
    }

    private org.springframework.test.web.servlet.ResultActions publish(String visibility) throws Exception {
        return mvc.perform(post("/api/v1/ip-studio/projects/project/template-versions")
                .principal(auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"模板\",\"visibility\":\"" + visibility + "\"}"));
    }

    @ParameterizedTest @EnumSource(AepUser.OperatorRole.class)
    void activeOperatorsAndSuperAdminsCanPublishOfficialTemplates(AepUser.OperatorRole role) throws Exception {
        user(role, AepUser.UserStatus.ACTIVE);
        publish("official").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.visibility").value("official"));
        verify(templates).publish(eq("author"), eq("project"),
                argThat(r -> "official".equals(r.visibility())));
    }

    @Test void ordinaryUsersCannotPublishOfficialTemplates() throws Exception {
        user(null, AepUser.UserStatus.ACTIVE);
        publish("official").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("OPERATOR_ONLY"));
        verifyNoInteractions(templates);
    }

    @ParameterizedTest @EnumSource(AepUser.OperatorRole.class)
    void suspendedOperatorsCannotPublishOfficialTemplates(AepUser.OperatorRole role) throws Exception {
        user(role, AepUser.UserStatus.SUSPENDED);
        publish("official").andExpect(status().isForbidden());
        verifyNoInteractions(templates);
    }

    @Test void missingAccountsCannotPublishOfficialTemplates() throws Exception {
        when(users.findById("author")).thenReturn(Optional.empty());
        publish("official").andExpect(status().isForbidden());
        verifyNoInteractions(templates);
    }

    @Test void ordinaryUsersCanStillPublishPersonalTemplates() throws Exception {
        publish("personal").andExpect(status().isOk());
        verify(templates).publish(eq("author"), eq("project"),
                argThat(r -> "personal".equals(r.visibility())));
    }
}
