package com.aistareco.aep.config;

import com.aistareco.aep.model.AiAppBinding;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * v0.41：把旧 {@code AiModelProvider}（多模型 + 多用途 + priority）迁移到
 * 「{@link AiModelEndpoint}（固定单模型 + 内嵌 Key）+ {@link AiAppBinding}（用途→端点）」。
 *
 * 表 {@code ai_model_providers} 物理列复用（api_key_encrypted / default_model），旧行直接以
 * AiModelEndpoint 装载，无需搬迁。本 seeder 做两件加性、幂等的事：
 * <ol>
 *   <li>端点 model 回填：default_model 空但 models_json 有值 → 取 models[0].id；</li>
 *   <li>绑定回填：读旧 {@code purposes} / {@code priority} 列（实体已不映射），按 priority 升序，
 *       为每个用途建 AiAppBinding（仅当该用途尚未绑定时；首个最低 priority 端点胜）。</li>
 * </ol>
 *
 * 旧 {@code LlmApiKey} 行**保留**（弃用），不自动迁移（key 无上游绑定，无法独立成端点）；
 * 现网旧 sk-aep-* 经 AiModelEndpointKeyService 的兼容回退继续可验。
 *
 * 全新 DB（无 purposes/priority 列）：native 读会失败 → 仅 log 跳过（无旧行可迁，正常）。
 */
@Component
@Order(55)
public class AiModelEndpointBindingSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AiModelEndpointBindingSeeder.class);
    private static final ObjectMapper OM = new ObjectMapper();

    private final AiModelEndpointRepository endpointRepo;
    private final AiAppBindingRepository bindingRepo;
    private final DataSource dataSource;
    private final TransactionTemplate txTemplate;

    public AiModelEndpointBindingSeeder(AiModelEndpointRepository endpointRepo,
                                        AiAppBindingRepository bindingRepo,
                                        DataSource dataSource,
                                        PlatformTransactionManager txManager) {
        this.endpointRepo = endpointRepo;
        this.bindingRepo = bindingRepo;
        this.dataSource = dataSource;
        this.txTemplate = new TransactionTemplate(txManager);
    }

    @Override
    public void run(String... args) {
        try {
            txTemplate.executeWithoutResult(status -> backfillEndpointModels());
        } catch (Exception e) {
            log.warn("[ai-endpoint-migration] backfillEndpointModels failed: {}", e.getMessage());
        }
        try {
            backfillBindings();
        } catch (Exception e) {
            log.warn("[ai-endpoint-migration] backfillBindings failed: {}", e.getMessage());
        }
    }

    /** default_model 空但 models_json 有值 → 取首个模型 id。 */
    private void backfillEndpointModels() {
        int fixed = 0;
        for (AiModelEndpoint e : endpointRepo.findAll()) {
            if (e.getModel() != null && !e.getModel().isBlank()) continue;
            String firstModel = firstModelId(e.getModelsJson());
            if (firstModel != null) {
                e.setModel(firstModel);
                endpointRepo.save(e);
                fixed++;
            }
        }
        if (fixed > 0) log.info("[ai-endpoint-migration] backfilled model on {} endpoint(s)", fixed);
    }

    /** 读旧 purposes/priority 列 → 为每个用途建绑定（仅当缺失；首个最低 priority 胜）。 */
    private void backfillBindings() {
        List<LegacyRow> rows = readLegacyRows();
        if (rows == null) {
            log.debug("[ai-endpoint-migration] no legacy purposes/priority columns (fresh DB?) — skip binding backfill");
            return;
        }
        rows.sort(Comparator.comparingInt(r -> r.priority));
        int created = 0;
        for (LegacyRow row : rows) {
            for (String purposeWire : row.purposes) {
                AiModelPurpose purpose;
                try {
                    purpose = AiModelPurpose.valueOf(purposeWire.trim().toUpperCase());
                } catch (Exception ex) {
                    continue; // 未知用途串，跳过
                }
                if (bindingRepo.existsById(purpose)) continue; // 首个最低 priority 已占，跳过
                if (!endpointRepo.existsById(row.id)) continue; // 端点不存在（异常数据），跳过
                AiAppBinding b = new AiAppBinding();
                b.setPurpose(purpose);
                b.setEndpointId(row.id);
                bindingRepo.save(b);
                created++;
            }
        }
        if (created > 0) log.info("[ai-endpoint-migration] created {} AI app binding(s) from legacy purposes", created);
    }

    /** 用独立 Connection 读旧列；列不存在（全新 DB）→ 返回 null。 */
    private List<LegacyRow> readLegacyRows() {
        String sql = "SELECT id, purposes, priority FROM ai_model_providers";
        try (Connection conn = dataSource.getConnection();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            List<LegacyRow> out = new ArrayList<>();
            while (rs.next()) {
                String id = rs.getString("id");
                String purposesJson = rs.getString("purposes");
                int priority = rs.getInt("priority");
                if (rs.wasNull()) priority = 100;
                out.add(new LegacyRow(id, parsePurposes(purposesJson), priority));
            }
            return out;
        } catch (Exception e) {
            // 列不存在 / 表不存在等 → 全新 DB，无旧行可迁
            log.debug("[ai-endpoint-migration] readLegacyRows skipped: {}", e.getMessage());
            return null;
        }
    }

    private static List<String> parsePurposes(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return OM.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String firstModelId(String modelsJson) {
        if (modelsJson == null || modelsJson.isBlank()) return null;
        try {
            List<java.util.Map<String, Object>> models =
                    OM.readValue(modelsJson, new TypeReference<List<java.util.Map<String, Object>>>() {});
            for (java.util.Map<String, Object> m : models) {
                Object id = m.get("id");
                if (id != null && !String.valueOf(id).isBlank()) return String.valueOf(id);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private record LegacyRow(String id, List<String> purposes, int priority) {}
}
