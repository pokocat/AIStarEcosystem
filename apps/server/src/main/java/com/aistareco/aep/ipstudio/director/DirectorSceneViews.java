package com.aistareco.aep.ipstudio.director;

import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 场景四视图：模型出一张 2×2 整图（左上主视、右上反打、左下左立面、右下右立面），这里切成四格。
 * 左上那格只是让模型对齐空间用的，主视仍是资产已采用的那张图，切出来只留另外三格。
 */
public final class DirectorSceneViews {
    /** 存进作品的视角编号 → 界面和提示词里的叫法。主视就是资产图本身，不在这里。 */
    public static final Map<String, String> LABELS;
    static {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("reverse", "反打");
        m.put("left", "左立面");
        m.put("right", "右立面");
        LABELS = java.util.Collections.unmodifiableMap(m);
    }

    private DirectorSceneViews() {}

    /** 按 reverse、left、right 的顺序返回三格 PNG。读不出图片按失败处理，不产半成品。 */
    public static List<byte[]> split(byte[] grid) {
        BufferedImage image;
        try { image = ImageIO.read(new ByteArrayInputStream(grid)); }
        catch (IOException e) { throw unreadable(); }
        if (image == null || image.getWidth() < 2 || image.getHeight() < 2) throw unreadable();
        int w = image.getWidth() / 2, h = image.getHeight() / 2;
        List<byte[]> out = new ArrayList<>(3);
        out.add(png(image.getSubimage(w, 0, w, h)));
        out.add(png(image.getSubimage(0, h, w, h)));
        out.add(png(image.getSubimage(w, h, w, h)));
        return out;
    }

    private static byte[] png(BufferedImage cell) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(cell, "png", out);
            return out.toByteArray();
        } catch (IOException e) { throw unreadable(); }
    }

    private static BusinessException unreadable() {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "DIRECTOR_SCENE_VIEWS_UNREADABLE", "生成的四视图读取失败，请重新生成");
    }
}
