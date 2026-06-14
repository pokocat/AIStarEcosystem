package com.aistareco.aep.config;

import com.aistareco.aep.model.DramaRecipe;
import com.aistareco.aep.repository.DramaRecipeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DramaRecipeSeederTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final String FIRST_SKILL_ID = "16cb3355db4642ca982c02d5f893d9dd";

    @Test
    void localDriverSeedsPublicPreviewVideoUrls() {
        DramaRecipeRepository repo = repo();

        new DramaRecipeSeeder(repo, OM, "local", "auto").run();

        List<DramaRecipe> rows = capturedRows(repo);
        assertEquals(28, rows.size());
        assertEquals("https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/seed/flova/skills/" + FIRST_SKILL_ID + ".mp4",
                rows.get(0).getPreviewVideo());
        assertTrue(rows.stream().filter(r -> r.getPreviewVideo() != null).allMatch(r -> r.getPreviewVideo().startsWith("https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/seed/flova/skills/")));
        DramaRecipe home = rows.stream().filter(r -> "rcp-official-home-single-mother".equals(r.getId())).findFirst().orElseThrow();
        assertEquals("/recipes/home/single-mother.jpg", home.getCoverImage());
    }

    @Test
    void logicalModeSeedsLogicalPreviewVideoKeys() {
        DramaRecipeRepository repo = repo();

        new DramaRecipeSeeder(repo, OM, "local", "logical-key").run();

        List<DramaRecipe> rows = capturedRows(repo);
        assertEquals(28, rows.size());
        assertEquals("seed/flova/skills/" + FIRST_SKILL_ID + ".mp4", rows.get(0).getPreviewVideo());
        assertTrue(rows.stream().filter(r -> r.getPreviewVideo() != null).allMatch(r -> r.getPreviewVideo().startsWith("seed/flova/skills/")));
    }

    @Test
    void ossDriverSeedsUploadedOssPreviewVideoKeys() {
        DramaRecipeRepository repo = repo();

        new DramaRecipeSeeder(repo, OM, "oss", "auto").run();

        List<DramaRecipe> rows = capturedRows(repo);
        assertEquals(28, rows.size());
        assertEquals("media/seed/flova/skills/" + FIRST_SKILL_ID + ".mp4", rows.get(0).getPreviewVideo());
        assertTrue(rows.stream().filter(r -> r.getPreviewVideo() != null).allMatch(r -> r.getPreviewVideo().startsWith("media/seed/flova/skills/")));
        DramaRecipe home = rows.stream().filter(r -> "rcp-official-home-single-mother".equals(r.getId())).findFirst().orElseThrow();
        assertEquals("media/seed/drama/recipes/home/single-mother.jpg", home.getCoverImage());
    }

    private static DramaRecipeRepository repo() {
        DramaRecipeRepository repo = mock(DramaRecipeRepository.class);
        when(repo.findById(anyString())).thenReturn(Optional.empty());
        when(repo.save(any(DramaRecipe.class))).thenAnswer(inv -> inv.getArgument(0));
        return repo;
    }

    private static List<DramaRecipe> capturedRows(DramaRecipeRepository repo) {
        ArgumentCaptor<DramaRecipe> captor = ArgumentCaptor.forClass(DramaRecipe.class);
        verify(repo, times(28)).save(captor.capture());
        return captor.getAllValues();
    }
}
