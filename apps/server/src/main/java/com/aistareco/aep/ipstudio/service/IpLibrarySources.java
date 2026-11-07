package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.director.DirectorWorkRepository;
import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.LibrarySourceOption;
import com.aistareco.aep.ipstudio.repository.IpLibraryRecordRepository;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.aistareco.aep.ipstudio.repository.IpSavedAssetRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 资产库里的东西来自哪部作品、哪张画布。不按作品自动建文件夹（线上已有 164 个来源，文件夹继续只管手动整理），
 * 来源是单独的筛选维度。名字按当前的现查，只取名字不读正文。
 */
@Component
public class IpLibrarySources {
    public record Source(String id, String type, String title, boolean deleted) {}

    private final IpProjectRepository projects;
    private final DirectorWorkRepository works;
    private final IpSavedAssetRepository saved;
    private final IpLibraryRecordRepository records;
    private final ObjectMapper om;

    public IpLibrarySources(IpProjectRepository projects, DirectorWorkRepository works, IpSavedAssetRepository saved, IpLibraryRecordRepository records, ObjectMapper om) {
        this.projects = projects; this.works = works; this.saved = saved; this.records = records; this.om = om;
    }

    public Map<String, Source> of(String user) {
        Map<String, Source> out = new HashMap<>();
        for (Object[] row : projects.namesOf(user)) out.put((String) row[0], new Source((String) row[0], "canvas", (String) row[1], row[2] != null));
        for (Object[] row : works.namesOf(user)) out.put((String) row[0], new Source((String) row[0], "director", (String) row[1], row[2] != null));
        return out;
    }

    /** 一页素材用到的卡：id → 名字和类型。用户删掉的不算。 */
    public Map<String, JsonNode> objects(String user, java.util.Collection<String> ids) {
        Map<String, JsonNode> out = new HashMap<>();
        if (ids.isEmpty()) return out;
        for (var row : records.findAllById(ids))
            if (user.equals(row.getOwnerUserId()) && "object".equals(row.getRecordType()) && row.getDeletedAt() == null) out.put(row.getId(), read(row.getPayloadJson()));
        return out;
    }

    /** 这个人的资产库里实际出现过的来源，最近有内容的在前。 */
    public List<LibrarySourceOption> list(String user) {
        Map<String, Source> names = of(user);
        Map<String, Long> counts = new LinkedHashMap<>();
        for (var row : saved.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user)) {
            String from = read(row.getPayloadJson()).path("metadata").path("projectId").asText();
            if (names.containsKey(from)) counts.merge(from, 1L, Long::sum);
        }
        for (var row : records.findByOwnerUserIdAndRecordTypeAndDeletedAtIsNullOrderByCreatedAtDesc(user, "object")) {
            for (JsonNode source : read(row.getPayloadJson()).path("sources")) {
                String from = source.path("projectId").asText();
                if (names.containsKey(from)) counts.merge(from, 1L, Long::sum);
            }
        }
        List<LibrarySourceOption> out = new ArrayList<>();
        counts.forEach((id, count) -> {
            Source source = names.get(id);
            out.add(new LibrarySourceOption(id, source.type(), source.title(), source.deleted(), count));
        });
        return out;
    }

    private JsonNode read(String json) {
        try { return om.readTree(json); }
        catch (Exception e) { return om.createObjectNode(); }
    }
}
