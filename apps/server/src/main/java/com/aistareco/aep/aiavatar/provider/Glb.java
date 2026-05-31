package com.aistareco.aep.aiavatar.provider;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

/**
 * 最小**有效** GLB（glTF 2.0 二进制）生成器 —— 产出一个带颜色的立方体网格。
 *
 * 用于 Mock img23d Provider：产出真实可下载、可被任意 glTF 查看器（three.js / model-viewer）
 * 加载旋转的 .glb，满足任务书「3D 可交互 / 下载资产包」（接 TripoSR 后替换为真模型）。
 */
public final class Glb {

    private Glb() {}

    private static final int GLB_MAGIC = 0x46546C67;   // "glTF"
    private static final int JSON_TYPE = 0x4E4F534A;   // "JSON"
    private static final int BIN_TYPE = 0x004E4942;    // "BIN\0"

    public static byte[] cube(float size, int rgb) {
        float s = size <= 0 ? 0.5f : size;
        float[] pos = {
                -s, -s, -s, s, -s, -s, s, s, -s, -s, s, -s,
                -s, -s, s, s, -s, s, s, s, s, -s, s, s
        };
        int[] idx = {
                0, 1, 2, 0, 2, 3,
                4, 6, 5, 4, 7, 6,
                0, 4, 5, 0, 5, 1,
                3, 2, 6, 3, 6, 7,
                0, 3, 7, 0, 7, 4,
                1, 5, 6, 1, 6, 2
        };

        int idxLen = idx.length * 2;          // uint16
        int idxLenPad = align4(idxLen);
        int posOffset = idxLenPad;
        int posLen = pos.length * 4;          // float32
        int binLen = posOffset + posLen;

        ByteBuffer bin = ByteBuffer.allocate(binLen).order(ByteOrder.LITTLE_ENDIAN);
        for (int v : idx) bin.putShort((short) v);
        while (bin.position() < posOffset) bin.put((byte) 0);
        for (float f : pos) bin.putFloat(f);

        double r = ((rgb >> 16) & 0xFF) / 255.0;
        double gC = ((rgb >> 8) & 0xFF) / 255.0;
        double b = (rgb & 0xFF) / 255.0;

        String json = "{"
                + "\"asset\":{\"version\":\"2.0\",\"generator\":\"aep-aiavatar-mock\"},"
                + "\"scene\":0,"
                + "\"scenes\":[{\"nodes\":[0]}],"
                + "\"nodes\":[{\"mesh\":0,\"name\":\"aiavatar_avatar_bust\"}],"
                + "\"meshes\":[{\"primitives\":[{\"attributes\":{\"POSITION\":1},\"indices\":0,\"material\":0}]}],"
                + "\"materials\":[{\"pbrMetallicRoughness\":{\"baseColorFactor\":["
                + r + "," + gC + "," + b + ",1.0],\"metallicFactor\":0.1,\"roughnessFactor\":0.65}}],"
                + "\"buffers\":[{\"byteLength\":" + binLen + "}],"
                + "\"bufferViews\":["
                + "{\"buffer\":0,\"byteOffset\":0,\"byteLength\":" + idxLen + ",\"target\":34963},"
                + "{\"buffer\":0,\"byteOffset\":" + posOffset + ",\"byteLength\":" + posLen + ",\"target\":34962}"
                + "],"
                + "\"accessors\":["
                + "{\"bufferView\":0,\"componentType\":5123,\"count\":" + idx.length + ",\"type\":\"SCALAR\"},"
                + "{\"bufferView\":1,\"componentType\":5126,\"count\":8,\"type\":\"VEC3\","
                + "\"min\":[" + (-s) + "," + (-s) + "," + (-s) + "],\"max\":[" + s + "," + s + "," + s + "]}"
                + "]}";

        byte[] jsonBytes = json.getBytes(StandardCharsets.UTF_8);
        int jsonPad = align4(jsonBytes.length);
        byte[] jsonChunk = new byte[jsonPad];
        System.arraycopy(jsonBytes, 0, jsonChunk, 0, jsonBytes.length);
        for (int i = jsonBytes.length; i < jsonPad; i++) jsonChunk[i] = 0x20; // space pad

        byte[] binArr = bin.array();
        int binPad = align4(binArr.length);
        byte[] binChunk = new byte[binPad];
        System.arraycopy(binArr, 0, binChunk, 0, binArr.length);

        int total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
        ByteArrayOutputStream out = new ByteArrayOutputStream(total);
        ByteBuffer header = ByteBuffer.allocate(12).order(ByteOrder.LITTLE_ENDIAN);
        header.putInt(GLB_MAGIC).putInt(2).putInt(total);
        out.writeBytes(header.array());

        ByteBuffer jh = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN);
        jh.putInt(jsonChunk.length).putInt(JSON_TYPE);
        out.writeBytes(jh.array());
        out.writeBytes(jsonChunk);

        ByteBuffer bh = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN);
        bh.putInt(binChunk.length).putInt(BIN_TYPE);
        out.writeBytes(bh.array());
        out.writeBytes(binChunk);

        return out.toByteArray();
    }

    private static int align4(int n) {
        return (n + 3) & ~3;
    }
}
