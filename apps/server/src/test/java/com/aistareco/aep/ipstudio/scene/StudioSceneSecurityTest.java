package com.aistareco.aep.ipstudio.scene;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 场景接口的权限：首页卡片对没登录的访客公开（公开落地页要显示），场景目录和拼话仍要登录，
 * 后台场景模板只给超管和平台运营。本地 dev 有自动登录过滤器，匿名访问只能在这里证。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:studio-scene-security;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false"
})
class StudioSceneSecurityTest {
    @Autowired MockMvc mvc;

    @Test
    void anonymousVisitorsSeeTheHomeCardsButNotTheCatalogOrTheAdminEditor() throws Exception {
        mvc.perform(get("/api/v1/ip-studio/scenes/home")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].sceneId").exists()).andExpect(jsonPath("$.data[0].prompt").doesNotExist());
        mvc.perform(get("/api/v1/ip-studio/scenes")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/studio/scenes")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    void ordinaryUsersCannotEditTheCatalog() throws Exception {
        mvc.perform(get("/api/admin/studio/scenes")).andExpect(status().isForbidden());
        mvc.perform(put("/api/admin/studio/scenes").contentType("application/json").content("{}")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void platformOperatorsCanReadTheCatalogForEditing() throws Exception {
        mvc.perform(get("/api/admin/studio/scenes")).andExpect(status().isOk()).andExpect(jsonPath("$.data.source").value("default"));
    }
}
