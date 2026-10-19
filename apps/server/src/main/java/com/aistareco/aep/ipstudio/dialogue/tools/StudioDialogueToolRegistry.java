package com.aistareco.aep.ipstudio.dialogue.tools;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.util.*;

/** The fixed server-side tool set. Tool declarations come from here only; skill text cannot add or widen a tool. */
@Component
public class StudioDialogueToolRegistry {
    private final Map<String, StudioDialogueTool> tools = new LinkedHashMap<>();

    public StudioDialogueToolRegistry(List<StudioDialogueTool> all) {
        for (var tool : all) if (tools.putIfAbsent(tool.name(), tool) != null) throw new IllegalStateException("Duplicate dialogue tool " + tool.name());
    }

    public Optional<StudioDialogueTool> find(String name) { return Optional.ofNullable(name == null ? null : tools.get(name)); }
    public Collection<StudioDialogueTool> all() { return tools.values(); }

    /** OpenAI-compatible tool declarations (native function calling). */
    public List<Map<String, Object>> specs(ObjectMapper mapper) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (var tool : tools.values()) {
            Map<String, Object> fn = new LinkedHashMap<>();
            fn.put("name", tool.name());
            fn.put("description", tool.description());
            fn.put("parameters", mapper.convertValue(tool.parameters(mapper), Map.class));
            out.add(Map.of("type", "function", "function", fn));
        }
        return out;
    }

    /** Same declarations as text, for the {@code {{tools}}} prompt variable (both action paths share one schema). */
    public String describe(ObjectMapper mapper) {
        StringBuilder out = new StringBuilder();
        for (var tool : tools.values())
            out.append("- ").append(tool.name()).append("：").append(tool.description()).append("\n  参数：")
                    .append(tool.parameters(mapper).toString()).append('\n');
        return out.toString();
    }
}
