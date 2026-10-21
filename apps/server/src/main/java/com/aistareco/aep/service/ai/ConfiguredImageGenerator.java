package com.aistareco.aep.service.ai;

import com.aistareco.aep.ipstudio.service.JusuanImageClient;
import com.aistareco.aep.model.AiImageRequestSpec;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Component;
import javax.imageio.ImageIO;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Native image wire adapter for existing asset/drama pixel presets; credit settlement stays with the caller. */
@Component
public class ConfiguredImageGenerator {
    private final JusuanImageClient transport;
    public ConfiguredImageGenerator(JusuanImageClient transport) {this.transport=transport;}

    public byte[] generate(AiModelEndpoint endpoint,AiModelPurpose purpose,String appCode,String prompt,String size,List<String> references) {
        var spec=AiImageRequestSpec.read(endpoint.getImageRequestSpecJson());
        String providerSize=providerSize(spec,size);
        if("1024x640".equals(size))prompt+=". Keep the subject inside the central 16:10 safe area; edges will be cropped to the legacy scene canvas.";
        var inputs=references==null?List.<String>of():references;
        JusuanImageClient.validate(endpoint,prompt,inputs.size(),providerSize);
        byte[] bytes=transport.generateResolved(endpoint,purpose,appCode,prompt,providerSize,inputs,"image-"+UUID.randomUUID());
        return normalize(bytes,providerSize,size);
    }

    /** Preserve the requested canvas ratio; choose the nearest legal provider pixels, never a different orientation. */
    public static String providerSize(AiImageRequestSpec spec,String size) {
        if(spec==null)throw BusinessException.badRequest("IMAGE_REQUEST_SPEC_INVALID","图片模型未配置请求规格");
        if(size==null || size.isBlank())return spec.outputs().get(0).canvasSize();
        if(spec.output(size)!=null)return size;
        int[] requested=dimensions(size);double ratio=(double)requested[0]/requested[1];
        // Existing scene entry has a fixed 16:10 canvas. Render a legal 3:2 image then crop, without stretching.
        if("1024x640".equals(size) && spec.output("1536x1024")!=null)return "1536x1024";
        return spec.outputs().stream().filter(o->{int[] d=dimensions(o.canvasSize());return Math.abs((double)d[0]/d[1]-ratio)/ratio<=0.02;})
                .min(Comparator.comparingDouble(o->{int[] d=dimensions(o.canvasSize());return Math.abs(Math.log((double)d[0]*d[1]/((double)requested[0]*requested[1])));}))
                .map(AiImageRequestSpec.Output::canvasSize).orElseThrow(()->BusinessException.badRequest("IMAGE_SIZE_UNSUPPORTED","图片模型不支持当前画幅，请选择支持的画幅"));
    }
    static byte[] normalize(byte[] bytes,String providerSize,String requestedSize) {
        if(requestedSize==null || requestedSize.isBlank() || providerSize.equals(requestedSize))return bytes;
        int[] d=dimensions(requestedSize);
        try {
            BufferedImage source=ImageIO.read(new ByteArrayInputStream(bytes));
            if(source==null)throw new IllegalArgumentException("unreadable image");
            BufferedImage result=new BufferedImage(d[0],d[1],source.getColorModel().hasAlpha()?BufferedImage.TYPE_INT_ARGB:BufferedImage.TYPE_INT_RGB);
            var g=result.createGraphics();try {g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);double scale=Math.max((double)d[0]/source.getWidth(),(double)d[1]/source.getHeight());
                int w=(int)Math.ceil(source.getWidth()*scale),h=(int)Math.ceil(source.getHeight()*scale);
                g.drawImage(source,(d[0]-w)/2,(d[1]-h)/2,w,h,null);}finally {g.dispose();}
            var out=new ByteArrayOutputStream();ImageIO.write(result,"png",out);return out.toByteArray();
        }catch(Exception e){throw BusinessException.badRequest("IMAGE_BAD_OUTPUT","图片生成结果无法读取，请联系运营核对模型输出");}
    }
    private static int[] dimensions(String size) {
        try {String[] v=size.split("x");if(v.length!=2)throw new IllegalArgumentException();int w=Integer.parseInt(v[0]),h=Integer.parseInt(v[1]);
            if(w<1 || h<1 || w>8192 || h>8192 || (long)w*h>32L*1024*1024)throw new IllegalArgumentException();return new int[]{w,h};
        }catch(Exception e){throw BusinessException.badRequest("IMAGE_SIZE_UNSUPPORTED","图片尺寸无效");}
    }
}
