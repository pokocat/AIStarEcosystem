package com.aistareco.aep.ipstudio.dialogue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;

/**
 * The writing on a canvas object as the user adopted it, for the canvas reader: the saved script (editor Markdown), else
 * the generated script, else the shot, else the text body. The editor's unsaved draft and the AI's pending proposal are
 * never read as the script (taken from the 2026-10-23 recovery branch, 2026-10-30).
 */
public final class StudioWritingContent {
    private StudioWritingContent() {}
    public record Source(String field, String text) {}

    public static Source read(JsonNode node) {
        JsonNode md = node.path("metadata"), studio = md.path("studio");
        // The editor commits only valid, nonblank Markdown. An empty legacy field is not an intentional deletion.
        // scriptEditor.draft may be incomplete and must not replace the adopted document in a read-only projection.
        if (nonBlank(studio.path("scriptMarkdown"))) return new Source("studio.scriptMarkdown", studio.path("scriptMarkdown").asText());
        if (studio.path("script").isObject()) {
            ObjectNode script = projectScript(studio.path("script"));
            if (hasWriting(script)) return new Source("studio.script", script.toString());
        }
        if (studio.path("shot").isObject()) {
            ObjectNode shot = projectShot(studio.path("shot"));
            if (hasWriting(shot)) return new Source("studio.shot", shot.toString());
        }
        return new Source("metadata.content", "text".equals(node.path("type").asText()) && md.path("content").isTextual()
                ? md.path("content").asText() : "");
    }

    private static ObjectNode projectScript(JsonNode script) {
        var out = project(script, List.of("title", "outline"), List.of());
        for (String field : List.of("characters", "scenes", "props")) {
            var items = out.putArray(field);
            if (script.path(field).isArray()) for (JsonNode item : script.path(field))
                items.add(project(item, List.of("name", "description"), List.of()));
        }
        var episodes = out.putArray("episodes");
        if (script.path("episodes").isArray()) for (JsonNode episode : script.path("episodes"))
            episodes.add(project(episode, List.of("title", "content"), List.of("no")));
        var shots = out.putArray("shots");
        if (script.path("shots").isArray()) for (JsonNode shot : script.path("shots")) shots.add(projectShot(shot));
        return out;
    }

    private static ObjectNode projectShot(JsonNode shot) {
        var out = project(shot, List.of("id", "title", "description", "dialogue"), List.of("episodeNo", "durationSec"));
        var names = out.putArray("characters");
        if (shot.path("characters").isArray()) for (JsonNode name : shot.path("characters"))
            if (name.isTextual()) names.add(name.asText());
        return out;
    }

    private static ObjectNode project(JsonNode source, List<String> textFields, List<String> numberFields) {
        var out = JsonNodeFactory.instance.objectNode();
        for (String field : textFields) if (source.path(field).isTextual()) out.set(field, source.path(field));
        for (String field : numberFields) if (source.path(field).isNumber()) out.set(field, source.path(field));
        return out;
    }

    private static boolean hasWriting(JsonNode value) {
        if (nonBlank(value)) return true;
        if (value.isContainerNode()) for (JsonNode child : value) if (hasWriting(child)) return true;
        return false;
    }
    private static boolean nonBlank(JsonNode value) { return value.isTextual() && !value.asText().isBlank(); }
}
