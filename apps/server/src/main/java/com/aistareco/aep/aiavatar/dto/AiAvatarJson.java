package com.aistareco.aep.aiavatar.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;

/** DTO 公共小工具：JSON 字符串 → JsonNode、OffsetDateTime → ISO 串。 */
public final class AiAvatarJson {

    private AiAvatarJson() {}

    public static JsonNode parseOrNull(String json, ObjectMapper mapper) {
        if (json == null || json.isBlank()) return null;
        try {
            return mapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    public static String fmt(OffsetDateTime t) {
        return t == null ? null : t.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }
}
