package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** ipstudio 单测共用脚手架：内存 repo + 画布文档构造器。 */
final class IpStudioFixtures {

    static final String USER = "u_owner";
    static final String OTHER = "u_stranger";
    static final ObjectMapper OM = new ObjectMapper();

    private IpStudioFixtures() {}

    // ── 内存 repo ─────────────────────────────────────────────

    static final class Projects {
        final Map<String, IpProject> rows = new LinkedHashMap<>();
        final IpProjectRepository repo = mock(IpProjectRepository.class);

        Projects() {
            when(repo.save(any())).thenAnswer(inv -> {
                IpProject p = inv.getArgument(0);
                rows.put(p.getId(), p);
                return p;
            });
            when(repo.existsById(anyString())).thenAnswer(inv -> rows.containsKey(inv.getArgument(0, String.class)));
            when(repo.findById(anyString())).thenAnswer(inv ->
                    Optional.ofNullable(rows.get(inv.getArgument(0, String.class))));
            when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(anyString(), anyString())).thenAnswer(inv -> {
                IpProject p = rows.get(inv.getArgument(0, String.class));
                boolean ok = p != null && p.getDeletedAt() == null
                        && inv.getArgument(1, String.class).equals(p.getOwnerUserId());
                return Optional.ofNullable(ok ? p : null);
            });
            when(repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(anyString())).thenAnswer(inv -> {
                String owner = inv.getArgument(0, String.class);
                return rows.values().stream()
                        .filter(p -> owner.equals(p.getOwnerUserId()) && p.getDeletedAt() == null)
                        .sorted(Comparator.comparing(IpProject::getUpdatedAt).reversed())
                        .toList();
            });
        }
    }

    static final class Runs {
        final Map<String, IpRun> rows = new LinkedHashMap<>();
        final IpRunRepository repo = mock(IpRunRepository.class);

        Runs() {
            when(repo.save(any())).thenAnswer(inv -> {
                IpRun r = inv.getArgument(0);
                rows.put(r.getId(), r);
                return r;
            });
            when(repo.existsById(anyString())).thenAnswer(inv -> rows.containsKey(inv.getArgument(0, String.class)));
            when(repo.findById(anyString())).thenAnswer(inv ->
                    Optional.ofNullable(rows.get(inv.getArgument(0, String.class))));
            when(repo.findByIdAndOwnerUserId(anyString(), anyString())).thenAnswer(inv -> {
                IpRun r = rows.get(inv.getArgument(0, String.class));
                boolean ok = r != null && inv.getArgument(1, String.class).equals(r.getOwnerUserId());
                return Optional.ofNullable(ok ? r : null);
            });
            when(repo.findByProjectIdOrderByCreatedAtDesc(anyString())).thenAnswer(inv -> {
                String pid = inv.getArgument(0, String.class);
                return rows.values().stream()
                        .filter(r -> pid.equals(r.getProjectId()))
                        .sorted(Comparator.comparing(IpRun::getCreatedAt).reversed())
                        .toList();
            });
            when(repo.findByProjectIdAndNodeIdAndStatus(anyString(), anyString(), anyString())).thenAnswer(inv -> {
                String pid = inv.getArgument(0, String.class);
                String node = inv.getArgument(1, String.class);
                String status = inv.getArgument(2, String.class);
                return rows.values().stream()
                        .filter(r -> pid.equals(r.getProjectId()) && node.equals(r.getNodeId())
                                && status.equals(r.getStatus()))
                        .toList();
            });
            when(repo.findByStatusAndHeartbeatAtBefore(anyString(), any())).thenAnswer(inv -> {
                String status = inv.getArgument(0, String.class);
                Instant before = inv.getArgument(1);
                return rows.values().stream()
                        .filter(r -> status.equals(r.getStatus())
                                && r.getHeartbeatAt() != null && r.getHeartbeatAt().isBefore(before))
                        .toList();
            });
        }
    }

    /**
     * mock 的 {@link FileStorageService}，key 形状与真实
     * {@code FileStorageService.buildKey} 一致：{@code <category>/<owner>/<uuid>.<ext>}，
     * 且 category / owner 里的 {@code /} 与非法字符归一为 {@code _}
     * （所以 {@code ipstudio/source} → {@code ipstudio_source}）。
     *
     * <p>形状必须真实：资产 key 归属闸就是按这个前缀判的，mock 随便给个形状会把闸门测成空气。
     */
    static FileStorageService storage() {
        FileStorageService storage = mock(FileStorageService.class);
        when(storage.signedUrl(anyString())).thenAnswer(inv ->
                "https://cdn.test/" + inv.getArgument(0, String.class) + "?sig=x");
        when(storage.allocateKey(anyString(), anyString(), anyString())).thenAnswer(inv ->
                buildKey(inv.getArgument(0, String.class), inv.getArgument(1, String.class)));
        when(storage.store(any(byte[].class), anyString(), anyString(), anyString(), anyString()))
                .thenAnswer(inv -> {
                    String key = buildKey(inv.getArgument(1, String.class), inv.getArgument(2, String.class));
                    return new FileStorageService.StoredFile(key, "https://cdn.test/" + key,
                            "https://cdn.test/" + key + "?sig=x", null, 1234, "image/png");
                });
        return storage;
    }

    private static String buildKey(String category, String ownerId) {
        return seg(category) + "/" + seg(ownerId) + "/"
                + java.util.UUID.randomUUID().toString().replace("-", "") + ".png";
    }

    private static String seg(String s) {
        return s == null ? "" : s.replaceAll("[^A-Za-z0-9_\\-]", "_");
    }

    /** 本人上传素材的合法 key（{@code ipstudio_source/<owner>/…}）。 */
    static String sourceKey(String owner, String name) {
        return seg(IpProjectService.CATEGORY_SOURCE) + "/" + seg(owner) + "/" + name;
    }

    /** 本人生成产物的合法 key（{@code ipstudio_gen/<owner>/…}）。 */
    static String genKey(String owner, String name) {
        return seg(IpProjectService.CATEGORY_GEN) + "/" + seg(owner) + "/" + name;
    }

    /**
     * 一张真的、能被 ImageIO 解码的 PNG。
     *
     * <p>worker 落库前会校验字节确实是图片（假图不许入库更不许扣款），
     * 所以出图 mock 不能再回 {@code new byte[]{1,2,3}}。
     */
    static byte[] pngBytes() {
        try {
            java.awt.image.BufferedImage img =
                    new java.awt.image.BufferedImage(8, 8, java.awt.image.BufferedImage.TYPE_INT_RGB);
            img.setRGB(0, 0, 0x123456);
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "png", bos);
            return bos.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** 指定尺寸的真 PNG（上传尺寸闸的测试用）。 */
    static byte[] pngBytes(int w, int h) {
        try {
            java.awt.image.BufferedImage img =
                    new java.awt.image.BufferedImage(w, h, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "png", bos);
            return bos.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static IpStudioProperties props() {
        return new IpStudioProperties();
    }

    // ── 画布文档构造器 ────────────────────────────────────────

    static final class Doc {
        final ObjectNode root = OM.createObjectNode();
        final ArrayNode nodes = root.putArray("nodes");
        final ArrayNode edges = root.putArray("edges");

        Doc() {
            ObjectNode vp = root.putObject("viewport");
            vp.put("x", 0).put("y", 0).put("zoom", 1);
        }

        ObjectNode node(String id, String type) {
            ObjectNode n = nodes.addObject();
            n.put("id", id);
            n.put("type", type);
            n.putObject("position").put("x", 0).put("y", 0);
            n.putObject("data");
            return (ObjectNode) n.get("data");
        }

        Doc edge(String from, String to) {
            edges.addObject().put("id", from + "->" + to).put("source", from).put("target", to);
            return this;
        }

        String json() {
            try {
                return OM.writeValueAsString(root);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }
    }

    /**
     * 完整链路的样本文档：source → identity → style → master(generate ×4)
     * → look → gen(generate ×2)，可选挂 N 个 reference 到 gen 上。
     */
    static Doc chainDoc(String masterRunId, int referenceCount) {
        Doc d = new Doc();
        d.node("n-source", "source").put("assetKey", sourceKey(USER, "photo.jpg"));
        ObjectNode identity = d.node("n-identity", "identity");
        identity.put("text", "脸型：鹅蛋脸\n五官：大眼高鼻\n标志性特征：左脸颊创可贴\n气质：安静少年感");
        identity.put("promptEn", "same person, consistent facial identity, oval face");
        identity.put("locked", true);
        ObjectNode style = d.node("n-style", "style");
        style.put("presetId", "bjd");
        style.put("name", "3D BJD 潮玩");
        style.put("promptEn", "3D rendered BJD doll figure");
        style.put("negativeEn", "no photorealistic skin,");
        style.put("custom", false);
        ObjectNode master = d.node("n-master", "generate");
        master.put("count", 4).put("size", "768x1024").put("isMaster", true);
        if (masterRunId != null) master.put("selectedRunId", masterRunId).put("selectedIndex", 1);
        ObjectNode look = d.node("n-look", "look");
        look.put("title", "穿针织衫拿着手机");
        look.put("outfit", "米白色针织冷帽，浅驼色露肩针织衫");
        look.put("pose", "正对镜头双手持手机低头看屏幕");
        look.put("expression", "专注");
        look.put("details", "纯色棚拍三点式灯光");
        look.put("props", "一部深色手机");
        ObjectNode gen = d.node("n-gen", "generate");
        gen.put("count", 2).put("size", "768x1024").put("isMaster", false);

        d.edge("n-source", "n-identity").edge("n-identity", "n-style").edge("n-style", "n-master")
                .edge("n-master", "n-look").edge("n-look", "n-gen");

        for (int i = 1; i <= referenceCount; i++) {
            ObjectNode ref = d.node("n-ref-" + i, "reference");
            ref.put("assetKey", sourceKey(USER, "ref-" + i + ".png"));
            ref.put("note", "hat style only " + i);
            d.edge("n-ref-" + i, "n-gen");
        }
        return d;
    }

    static IpProject project(String id, String owner, Doc doc) {
        return IpProject.builder()
                .id(id).ownerUserId(owner).name("测试 IP 项目")
                .status(IpProject.STATUS_DRAFT)
                .docJson(doc.json())
                .createdAt(Instant.now()).updatedAt(Instant.now())
                .build();
    }

    /** 已完成的 generate run，带 n 张候选。 */
    static IpRun doneGenerateRun(String id, String projectId, String nodeId, int candidates) {
        ObjectNode out = OM.createObjectNode();
        ArrayNode arr = out.putArray("candidates");
        for (int i = 0; i < candidates; i++) {
            arr.addObject().put("key", genKey(USER, nodeId + "-" + i + ".png"));
        }
        ObjectNode inputs = OM.createObjectNode();
        inputs.put("prompt", "a rendered prompt for " + nodeId);
        try {
            return IpRun.builder()
                    .id(id).projectId(projectId).ownerUserId(USER).nodeId(nodeId)
                    .kind(IpRun.KIND_GENERATE).status(IpRun.STATUS_DONE).stage("done").pct(100)
                    .cost(16)
                    .inputJson(OM.writeValueAsString(inputs))
                    .outputJson(OM.writeValueAsString(out))
                    .createdAt(Instant.now().minusSeconds(600))
                    .finishedAt(Instant.now().minusSeconds(590))
                    .build();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
