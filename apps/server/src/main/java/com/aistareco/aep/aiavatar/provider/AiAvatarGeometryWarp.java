package com.aistareco.aep.aiavatar.provider;

import java.awt.image.BufferedImage;

/**
 * 真实几何形变（任务书 §4「瘦脸/眼睛/鼻梁/脸型/嘴型」—— 确定性算法，非大模型，不要 mock）。
 *
 * 这是后端侧的**真实**液化形变实现：基于面部区域中心的径向 pinch/bulge（liquify）+ 局部缩放，
 * 逐像素反向映射 + 双线性采样。确定性、可复算。
 *
 * 说明（DECISIONS.md）：完整方案是 MediaPipe FaceMesh 478 关键点 + TPS。本环境无 MediaPipe，
 * 改用「以图像几何中心估计面部锚点」的简化版（中心径向液化）。可由前端 canvas
 * 复用同一族算法做实时预览，二者参数语义一致，可平滑替换为真 FaceMesh。
 *
 * 滑块语义（相对中性值，范围约 -100..100）：
 *  - slimFace   : 脸颊向内 pinch（瘦脸）
 *  - eyeSize    : 眼部区域放大 / 缩小
 *  - noseBridge : 鼻梁区域纵向拉伸
 *  - faceShape  : 下颌区域纵向缩放（脸型长短）
 *  - mouthShape : 嘴部区域横向缩放
 */
public final class AiAvatarGeometryWarp {

    private AiAvatarGeometryWarp() {}

    public record Sliders(double slimFace, double eyeSize, double noseBridge,
                          double faceShape, double mouthShape) {
        public boolean isNeutral() {
            return slimFace == 0 && eyeSize == 0 && noseBridge == 0 && faceShape == 0 && mouthShape == 0;
        }
    }

    /**
     * 对图像施加形变。坐标系按「人像居中、脸位于上半部」的常见构图估计锚点。
     */
    public static BufferedImage warp(BufferedImage src, Sliders s) {
        int w = src.getWidth();
        int h = src.getHeight();
        BufferedImage dst = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);

        // 估计面部锚点（归一化坐标）
        double faceCx = 0.5 * w;
        double faceCy = 0.42 * h;          // 脸中心略偏上
        double faceR = 0.30 * Math.min(w, h);
        double eyeCy = 0.36 * h;
        double eyeDx = 0.12 * w;           // 左右眼水平偏移
        double noseCy = 0.44 * h;
        double mouthCy = 0.54 * h;
        double jawCy = 0.60 * h;

        double slim = s.slimFace() / 100.0;       // -1..1
        double eye = s.eyeSize() / 100.0;
        double nose = s.noseBridge() / 100.0;
        double face = s.faceShape() / 100.0;
        double mouth = s.mouthShape() / 100.0;

        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                double sx = x;
                double sy = y;

                // 1) 瘦脸：脸颊区域水平向中线 pinch（强度随到脸中心的纵向接近度衰减）
                if (slim != 0) {
                    double vy = gaussian((y - faceCy) / (faceR * 0.9));
                    double dx = (x - faceCx);
                    sx += dx * 0.18 * slim * vy; // 反向采样：往外取样 = 视觉收缩
                }

                // 2) 眼睛缩放：两个眼睛锚点的径向 bulge。
                //    注意：coord 传累积后的 sx/sy（而非原始 x/y），否则 eye==0 时
                //    radial 的 no-op 分支会把前面 slimFace 累积的位移清掉。
                if (eye != 0) {
                    sx = radial(sx, sy, faceCx - eyeDx, eyeCy, faceR * 0.32, eye * 0.35, sx, true);
                    sy = radial(sx, sy, faceCx - eyeDx, eyeCy, faceR * 0.32, eye * 0.35, sy, false);
                    sx = radial(sx, sy, faceCx + eyeDx, eyeCy, faceR * 0.32, eye * 0.35, sx, true);
                    sy = radial(sx, sy, faceCx + eyeDx, eyeCy, faceR * 0.32, eye * 0.35, sy, false);
                }

                // 3) 鼻梁：鼻区纵向拉伸
                if (nose != 0) {
                    double vx = gaussian((x - faceCx) / (faceR * 0.18));
                    double vy = gaussian((y - noseCy) / (faceR * 0.45));
                    sy += (y - noseCy) * 0.12 * nose * vx * vy;
                }

                // 4) 脸型：下颌纵向缩放
                if (face != 0 && y > faceCy) {
                    double vy = gaussian((y - jawCy) / (faceR * 0.6));
                    sy += (y - jawCy) * 0.14 * face * vy;
                }

                // 5) 嘴型：嘴区横向缩放
                if (mouth != 0) {
                    double vy = gaussian((y - mouthCy) / (faceR * 0.22));
                    sx += (x - faceCx) * 0.14 * mouth * vy;
                }

                int rgb = sampleBilinear(src, sx, sy);
                dst.setRGB(x, y, rgb);
            }
        }
        return dst;
    }

    /** 径向液化：在 (cx,cy) 半径 r 内对单坐标分量做 bulge(+)/pinch(-)。amount>0 放大。 */
    private static double radial(double px, double py, double cx, double cy, double r,
                                 double amount, double coord, boolean isX) {
        if (amount == 0) return coord;
        double dx = px - cx, dy = py - cy;
        double dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= r || dist < 1e-6) return coord;
        double frac = dist / r;
        // 放大：往中心取样（缩短半径）；缩小：往外取样
        double scale = 1.0 - amount * (1.0 - frac) * (1.0 - frac);
        if (isX) {
            return cx + dx * scale;
        } else {
            return cy + dy * scale;
        }
    }

    private static double gaussian(double t) {
        return Math.exp(-t * t);
    }

    private static int sampleBilinear(BufferedImage img, double x, double y) {
        int w = img.getWidth(), h = img.getHeight();
        x = Math.max(0, Math.min(w - 1.001, x));
        y = Math.max(0, Math.min(h - 1.001, y));
        int x0 = (int) Math.floor(x), y0 = (int) Math.floor(y);
        int x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
        double fx = x - x0, fy = y - y0;
        int c00 = img.getRGB(x0, y0), c10 = img.getRGB(x1, y0);
        int c01 = img.getRGB(x0, y1), c11 = img.getRGB(x1, y1);
        int r = lerp2(ch(c00, 16), ch(c10, 16), ch(c01, 16), ch(c11, 16), fx, fy);
        int g = lerp2(ch(c00, 8), ch(c10, 8), ch(c01, 8), ch(c11, 8), fx, fy);
        int b = lerp2(ch(c00, 0), ch(c10, 0), ch(c01, 0), ch(c11, 0), fx, fy);
        return (0xFF << 24) | (r << 16) | (g << 8) | b;
    }

    private static int ch(int rgb, int shift) {
        return (rgb >> shift) & 0xFF;
    }

    private static int lerp2(int c00, int c10, int c01, int c11, double fx, double fy) {
        double top = c00 + (c10 - c00) * fx;
        double bot = c01 + (c11 - c01) * fx;
        double v = top + (bot - top) * fy;
        return (int) Math.round(Math.max(0, Math.min(255, v)));
    }
}
