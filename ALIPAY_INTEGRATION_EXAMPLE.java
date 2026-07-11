/**
 * 支付宝支付集成示例代码
 *
 * 此文件展示如何在 Spring Boot 项目中集成支付宝支付功能
 * 包括支付请求和异步回调处理
 *
 * 更新时间: 2026-07-10
 * 应用: AIStarEcosystem
 */

package com.aistareco.alipay.config;

import com.alipay.api.AlipayApiException;
import com.alipay.api.AlipayClient;
import com.alipay.api.DefaultAlipayClient;
import com.alipay.api.request.AlipayTradePagePayRequest;
import com.alipay.api.request.AlipayTradeWapPayRequest;
import com.alipay.api.response.AlipayTradePagePayResponse;
import com.alipay.api.response.AlipayTradeWapPayResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * 支付宝客户端配置
 *
 * 配置说明：
 * - appId: 2021006169613183
 * - gatewayUrl: https://openapi.alipay.com/gateway.do
 * - 签名方式: RSA2
 */
@Configuration
public class AlipayClientConfig {

    @Value("${alipay.app-id:2021006169613183}")
    private String appId;

    @Value("${alipay.gateway-url:https://openapi.alipay.com/gateway.do}")
    private String gatewayUrl;

    @Value("${alipay.app-private-key}")
    private String appPrivateKey;

    @Value("${alipay.alipay-public-key}")
    private String alipayPublicKey;

    @Value("${alipay.charset:UTF-8}")
    private String charset;

    @Value("${alipay.sign-type:RSA2}")
    private String signType;

    /**
     * 创建支付宝客户端 Bean
     *
     * @return AlipayClient 实例
     */
    @Bean
    public AlipayClient alipayClient() {
        return new DefaultAlipayClient(
            gatewayUrl,           // 支付宝网关地址
            appId,                // 应用ID
            appPrivateKey,        // 应用私钥
            "json",               // 格式
            charset,              // 编码
            alipayPublicKey,      // 支付宝公钥
            signType              // 签名方式
        );
    }
}

/**
 * 支付宝支付服务类
 *
 * 提供支付宝支付相关的业务逻辑
 */
@Service
public class AlipayPaymentService {

    private final AlipayClient alipayClient;

    @Value("${alipay.notify-url:https://api.aibuzz.cn/api/alipay/notify}")
    private String notifyUrl;

    @Value("${alipay.return-url:https://aibuzz.cn/payment/return}")
    private String returnUrl;

    @Value("${alipay.timeout-express:30m}")
    private String timeoutExpress;

    public AlipayPaymentService(AlipayClient alipayClient) {
        this.alipayClient = alipayClient;
    }

    /**
     * 生成网页支付请求（电脑端支付）
     *
     * 用途: 在网页上显示支付表单或跳转到支付宝
     *
     * @param outTradeNo 商户订单号（唯一）
     * @param subject 订单标题
     * @param totalAmount 订单金额（单位：元，如：99.99）
     * @param buyerId 买家ID（可选）
     * @return 支付表单HTML
     */
    public String generatePagePayForm(
        String outTradeNo,
        String subject,
        String totalAmount,
        String buyerId
    ) throws AlipayApiException {
        // 创建支付宝支付请求
        AlipayTradePagePayRequest request = new AlipayTradePagePayRequest();

        // 设置回调地址
        request.setReturnUrl(returnUrl);
        request.setNotifyUrl(notifyUrl);

        // 构建业务参数（JSON格式）
        Map<String, Object> bizContent = new HashMap<>();
        bizContent.put("out_trade_no", outTradeNo);     // 商户订单号
        bizContent.put("total_amount", totalAmount);    // 订单金额
        bizContent.put("subject", subject);             // 订单标题
        bizContent.put("buyer_id", buyerId);            // 买家ID
        bizContent.put("timeout_express", "30m");       // 订单超时时间
        bizContent.put("product_code", "FAST_INSTANT_TRADE_PAY");  // 产品码

        request.setBizContent(jsonToString(bizContent));

        // 执行请求
        AlipayTradePagePayResponse response = alipayClient.pageExecute(request);

        if (response.isSuccess()) {
            System.out.println("支付宝网页支付请求成功");
            // 返回支付表单 HTML，可直接展示给用户
            return response.getBody();
        } else {
            System.out.println("支付宝网页支付请求失败");
            throw new RuntimeException("支付宝支付请求失败: " + response.getSubCode());
        }
    }

    /**
     * 生成移动端支付请求（H5/手机网页支付）
     *
     * 用途: 在手机上进行支付
     *
     * @param outTradeNo 商户订单号
     * @param subject 订单标题
     * @param totalAmount 订单金额
     * @param buyerId 买家ID
     * @return 支付跳转URL
     */
    public String generateWapPayUrl(
        String outTradeNo,
        String subject,
        String totalAmount,
        String buyerId
    ) throws AlipayApiException {
        AlipayTradeWapPayRequest request = new AlipayTradeWapPayRequest();

        request.setReturnUrl(returnUrl + "?mobile=true");
        request.setNotifyUrl(notifyUrl);

        Map<String, Object> bizContent = new HashMap<>();
        bizContent.put("out_trade_no", outTradeNo);
        bizContent.put("total_amount", totalAmount);
        bizContent.put("subject", subject);
        bizContent.put("buyer_id", buyerId);
        bizContent.put("timeout_express", "30m");
        bizContent.put("product_code", "QUICK_WAP_PAY");

        request.setBizContent(jsonToString(bizContent));

        AlipayTradeWapPayResponse response = alipayClient.pageExecute(request);

        if (response.isSuccess()) {
            return response.getBody();  // 返回支付页面
        } else {
            throw new RuntimeException("支付宝H5支付请求失败: " + response.getSubCode());
        }
    }

    /**
     * 验证异步回调签名
     *
     * 支付宝会在支付完成后异步通知商户，需要验证回调内容的真实性
     *
     * @param params 回调参数 Map
     * @return 签名是否有效
     */
    public boolean verifyNotifySignature(Map<String, String> params) {
        try {
            // 支付宝 SDK 提供的验签方法
            // 注意: 需要使用支付宝公钥来验证
            return com.alipay.api.internal.util.AlipaySignature.rsaCheckV1(
                params,
                alipayPublicKey,
                "UTF-8",
                "RSA2"
            );
        } catch (AlipayApiException e) {
            System.err.println("验证签名异常: " + e.getMessage());
            return false;
        }
    }

    /**
     * 处理支付宝异步回调
     *
     * 回调参数说明:
     * - trade_no: 支付宝交易号（唯一）
     * - out_trade_no: 商户订单号
     * - trade_status: 交易状态（TRADE_SUCCESS、TRADE_FINISHED 等）
     * - total_amount: 交易金额
     * - buyer_id: 买家ID
     * - gmt_payment: 支付时间
     *
     * @param params 回调参数
     * @return 处理结果
     */
    public boolean handleNotifyCallback(Map<String, String> params) {
        // 1. 验证签名
        if (!verifyNotifySignature(params)) {
            System.err.println("回调签名验证失败，可能是伪造请求");
            return false;
        }

        // 2. 获取回调参数
        String tradeNo = params.get("trade_no");           // 支付宝交易号
        String outTradeNo = params.get("out_trade_no");    // 商户订单号
        String tradeStatus = params.get("trade_status");   // 交易状态
        String totalAmount = params.get("total_amount");   // 交易金额
        String buyerId = params.get("buyer_id");           // 买家ID
        String gmtPayment = params.get("gmt_payment");     // 支付时间

        // 3. 验证订单号（防重复处理）
        // 检查此订单是否已处理过，避免重复处理
        if (orderAlreadyProcessed(outTradeNo)) {
            System.out.println("订单已处理过，跳过重复处理: " + outTradeNo);
            return true;  // 返回 true 避免支付宝重试
        }

        // 4. 验证金额
        // 比对本地订单金额和回调金额是否一致
        String localAmount = getOrderAmount(outTradeNo);
        if (!totalAmount.equals(localAmount)) {
            System.err.println("金额不匹配！订单号: " + outTradeNo);
            return false;
        }

        // 5. 更新订单状态
        if ("TRADE_SUCCESS".equals(tradeStatus) || "TRADE_FINISHED".equals(tradeStatus)) {
            // 支付成功，更新订单状态
            updateOrderStatusToPaid(outTradeNo, tradeNo, buyerId, gmtPayment);
            System.out.println("订单支付成功: " + outTradeNo);
            return true;
        } else {
            System.out.println("交易状态未成功: " + tradeStatus);
            return false;
        }
    }

    // ========== 辅助方法 ==========

    private String jsonToString(Map<String, Object> map) {
        // 可以使用 fastjson、gson 等 JSON 库
        // 这里简化为伪代码
        return com.alibaba.fastjson.JSON.toJSONString(map);
    }

    private boolean orderAlreadyProcessed(String outTradeNo) {
        // 实现: 查询数据库检查订单是否已支付
        // 伪代码示例：
        // Order order = orderService.findByOrderNo(outTradeNo);
        // return order != null && order.isPaid();
        return false;
    }

    private String getOrderAmount(String outTradeNo) {
        // 实现: 从数据库获取订单金额
        // 伪代码示例：
        // Order order = orderService.findByOrderNo(outTradeNo);
        // return order.getTotalAmount();
        return "0.00";
    }

    private void updateOrderStatusToPaid(
        String outTradeNo,
        String alipayTradeNo,
        String buyerId,
        String paymentTime
    ) {
        // 实现: 更新数据库订单状态
        // 伪代码示例：
        // Order order = orderService.findByOrderNo(outTradeNo);
        // order.setStatus("PAID");
        // order.setAlipayTradeNo(alipayTradeNo);
        // order.setBuyerId(buyerId);
        // order.setPaymentTime(paymentTime);
        // orderService.update(order);
    }
}

/**
 * Spring Boot Controller 示例
 *
 * 展示如何在控制器中使用支付宝服务
 */
@org.springframework.web.bind.annotation.RestController
@org.springframework.web.bind.annotation.RequestMapping("/api/alipay")
class AlipayPaymentController {

    private final AlipayPaymentService alipayPaymentService;

    public AlipayPaymentController(AlipayPaymentService alipayPaymentService) {
        this.alipayPaymentService = alipayPaymentService;
    }

    /**
     * 支付请求端点
     *
     * POST /api/alipay/pay
     *
     * 请求体:
     * {
     *   "outTradeNo": "ORDER20260710001",
     *   "subject": "AI明星带货商品",
     *   "totalAmount": "99.99",
     *   "buyerId": "user123"
     * }
     */
    @org.springframework.web.bind.annotation.PostMapping("/pay")
    public String createPayment(
        @org.springframework.web.bind.annotation.RequestBody Map<String, String> request
    ) throws AlipayApiException {
        String outTradeNo = request.get("outTradeNo");
        String subject = request.get("subject");
        String totalAmount = request.get("totalAmount");
        String buyerId = request.get("buyerId");

        // 生成支付表单
        String paymentForm = alipayPaymentService.generatePagePayForm(
            outTradeNo, subject, totalAmount, buyerId
        );

        return paymentForm;  // 返回 HTML 表单给前端
    }

    /**
     * 异步回调端点
     *
     * POST /api/alipay/notify
     *
     * 支付宝会在支付完成后调用此端点
     *
     * 注意: 必须返回 "success" 字符串，否则支付宝会继续重试
     */
    @org.springframework.web.bind.annotation.PostMapping("/notify")
    public String handleNotify(
        @org.springframework.web.bind.annotation.RequestParam Map<String, String> params
    ) {
        boolean success = alipayPaymentService.handleNotifyCallback(params);

        // 支付宝要求：处理成功返回 "success"，否则返回其他内容
        return success ? "success" : "fail";
    }

    /**
     * 支付完成后的返回页面
     *
     * GET /api/alipay/return
     *
     * 用户支付完成后会返回到此页面
     */
    @org.springframework.web.bind.annotation.GetMapping("/return")
    public String paymentReturn(
        @org.springframework.web.bind.annotation.RequestParam String out_trade_no
    ) {
        // 显示支付完成页面，可以跳转到订单详情
        return "支付成功！订单号: " + out_trade_no;
    }
}

/**
 * 环境配置说明
 *
 * 需要在 application.yml 或 .env 文件中配置：
 *
 * alipay:
 *   app-id: 2021006169613183
 *   app-private-key: ${ALIPAY_APP_PRIVATE_KEY}  # 从环境变量读取
 *   alipay-public-key: ${ALIPAY_PUBLIC_KEY}
 *   gateway-url: https://openapi.alipay.com/gateway.do
 *   notify-url: https://api.aibuzz.cn/api/alipay/notify
 *   return-url: https://aibuzz.cn/payment/return
 *   timeout-express: 30m
 *
 * 依赖版本：
 *
 * <dependency>
 *   <groupId>com.alipay.sdk</groupId>
 *   <artifactId>alipay-sdk-java</artifactId>
 *   <version>4.39.0.ALL</version>
 * </dependency>
 *
 * <dependency>
 *   <groupId>com.alibaba</groupId>
 *   <artifactId>fastjson</artifactId>
 *   <version>2.0.41</version>
 * </dependency>
 */
