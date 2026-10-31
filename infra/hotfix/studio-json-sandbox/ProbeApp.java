import com.aistareco.aep.ipstudio.service.ModelJson;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

/** Isolated test application. Only synthetic inputs and explicitly supplied saved responses; no product services. */
public class ProbeApp {
    public static void main(String[] args) throws Exception {
        var mapper = new ObjectMapper();
        var root = Path.of(args[0]);
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/health", e -> {
            byte[] bytes = "ok".getBytes(StandardCharsets.UTF_8);
            e.sendResponseHeaders(200, bytes.length); e.getResponseBody().write(bytes); e.close();
        });
        server.createContext("/probe", e -> {
            String name = e.getRequestURI().getRawQuery();
            Map<String, Object> out = new LinkedHashMap<>();
            int status = 200;
            try {
                String raw = switch (name == null ? "valid" : name) {
                    case "valid" -> "{\"content\":\"合法正文\"}";
                    case "han" -> "{\"content\":\"没有言语。\\更远处传来孩子们的笑声。\"";
                    case "half" -> "{\"content\":\"半句话";
                    case "ascii" -> "{\"content\":\"未知\\q转义\"}";
                    case "missing" -> "{\"content\":}";
                    case "real1" -> Files.readString(root.resolve("real1.json"));
                    case "real2" -> Files.readString(root.resolve("real2.json"));
                    default -> throw new IllegalArgumentException("unknown probe");
                };
                var result = ModelJson.parse(mapper, raw);
                String text = result.path("content").asText();
                out.put("chars", text.length());
                out.put("sha256", HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))));
                out.put("applicationNode", result.getClass().getClassLoader() == mapper.getClass().getClassLoader());
                out.put("pid", ProcessHandle.current().pid());
            } catch (Throwable failure) {
                status = 502; out.put("error", failure.getClass().getName()); out.put("message", failure.getMessage());
                try { out.put("code", failure.getClass().getMethod("getCode").invoke(failure)); } catch (Exception ignored) { }
            }
            byte[] bytes = mapper.writeValueAsBytes(out);
            e.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            e.sendResponseHeaders(status, bytes.length); e.getResponseBody().write(bytes); e.close();
        });
        server.start();
        // Load the exact class before Sandbox attaches, as in the running Spring application.
        ModelJson.parse(mapper, "{}");
        System.out.println("READY " + server.getAddress().getPort() + " " + ProcessHandle.current().pid());
        System.out.flush();
        System.in.read();
        server.stop(0);
    }
}
