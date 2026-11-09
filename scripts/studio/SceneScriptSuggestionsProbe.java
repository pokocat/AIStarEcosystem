import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog;
import com.aistareco.aep.ipstudio.service.ModelJson;
import com.aistareco.aep.ipstudio.service.StudioTextRevision;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;

/** Credential-free real-model probe: prepare exact application prompts or validate saved supplier replies. */
public class SceneScriptSuggestionsProbe {
    public static void main(String[] args) throws Exception {
        var mapper = new ObjectMapper();
        Path directory = Path.of(args[1]); Files.createDirectories(directory);
        int sample = Integer.parseInt(args[2]);
        if (args[0].equals("prepare")) {
            var request = mapper.createObjectNode().put("kind", "video-script").put("sceneId", "ecom-talking")
                    .put("text", "给喜欢记录日常的人介绍一款白色便携小相机，镜头旁有彩色条纹。突出出门随手记录的场景，不补充功能或价格。")
                    .put("duration", 15).put("ratio", "9:16").put("language", "中文");
            request.putArray("imageTitles").add("白色便携小相机.jpg");
            String current = null;
            if (sample > 1) {
                var previous = mapper.readTree(directory.resolve("validated-" + (sample - 1) + ".json").toFile());
                current = previous.path("content").asText();
                request.put("revision", previous.path("suggestions").get(0).path("instruction").asText());
            }
            var assembled = new StudioSceneCatalog().sceneScript(mapper.treeToValue(request, StudioSceneCatalog.ComposeRequest.class), current, false, null);
            var output = mapper.createObjectNode().put("system", assembled.system()).put("user", assembled.user());
            output.set("scene", request); output.set("params", mapper.valueToTree(assembled.params()));
            mapper.writerWithDefaultPrettyPrinter().writeValue(directory.resolve("prompt-" + sample + ".json").toFile(), output);
        } else {
            var raw = mapper.readTree(directory.resolve("response-" + sample + ".json").toFile());
            String content = raw.path("choices").get(0).path("message").path("content").asText();
            Files.writeString(directory.resolve("raw-" + sample + ".txt"), content); // retain before business parsing
            var revision = ModelJson.parse(mapper, content);
            StudioTextRevision.validateOutput(revision); StudioTextRevision.normalizeSceneSuggestions(revision);
            if (revision.path("suggestions").isEmpty()) throw new IllegalStateException("No valid model suggestions");
            mapper.writerWithDefaultPrettyPrinter().writeValue(directory.resolve("validated-" + sample + ".json").toFile(), revision);
            var report = mapper.createObjectNode().put("sample", sample).put("bodyChars", revision.path("content").asText().length());
            report.set("suggestions", revision.path("suggestions"));
            System.out.println(report);
        }
    }
}
