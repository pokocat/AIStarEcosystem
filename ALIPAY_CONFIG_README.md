# 支付宝支付集成配置指南

## 📋 配置文件说明

本项目包含以下支付宝集成配置文件：

| 文件 | 说明 | 是否敏感 |
|------|------|--------|
| `alipay.config.yaml` | 主配置文件，包含所有支付宝参数 | ⚠️ 部分敏感 |
| `.env.alipay.example` | 环境变量模板，存储密钥 | ⚠️ 高度敏感 |
| `.env.alipay` | 实际环境变量文件（本地使用） | 🔒 已 .gitignore |

---

## 🔑 获取配置信息

### 已配置信息（来自支付宝平台）

```yaml
# 应用基本信息
App ID: 2021006169613183
应用名称: AIStarEcoSystem
商家账号: **成 pok***@163.com（脱敏）

# 网关信息
支付宝网关: https://openapi.alipay.com/gateway.do
回调地址: https://api.aibuzz.cn/api/alipay/notify

# 签名方式
类型: RSA2 密钥
状态: ✅ 已配置
```

### 需要本地添加的信息

你需要从支付宝开发者平台获取两个关键的密钥：

#### 1️⃣ 应用私钥（Application Private Key）
- **获取路径**：[支付宝开发平台](https://open.alipay.com) 
  → 控制台 
  → 应用详情 
  → 开发设置 
  → 接口加签方式 
  → 设置
  
- **获取方法**：使用支付宝密钥工具生成
  - 选择：密钥方式 → RSA2 算法 → 生成密钥
  - 复制"应用私钥"内容

- **格式示例**：
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDr...
更多内容...
-----END PRIVATE KEY-----
```

#### 2️⃣ 支付宝公钥（Alipay Public Key）
- **获取路径**：同上，在设置接口加签方式后，支付宝会提供公钥

- **在哪里找到**：
  - 支付宝开发者平台 
  → 应用详情 
  → 开发设置 
  → 接口加签方式 
  → 已配置状态下可查看

- **格式示例**：
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
更多内容...
-----END PUBLIC KEY-----
```

---

## ⚙️ 本地配置步骤

### Step 1: 创建本地配置文件

```bash
cd /Users/donis/dev/AIStarEcosystem

# 复制环境变量模板
cp .env.alipay.example .env.alipay
```

### Step 2: 填写密钥信息

编辑 `.env.alipay` 文件，替换以下占位符：

```env
# 替换这两处的密钥内容
ALIPAY_APP_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
[你的应用私钥]
-----END PRIVATE KEY-----

ALIPAY_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
[支付宝公钥]
-----END PUBLIC KEY-----
```

### Step 3: 保护敏感文件

确保 `.env.alipay` 已在 `.gitignore` 中：

```bash
# 检查 .gitignore
cat .gitignore | grep -E "\.env.*alipay"

# 如果没有，添加：
echo ".env.alipay" >> .gitignore
echo ".env.alipay.local" >> .gitignore
```

### Step 4: 在项目中加载配置

#### Spring Boot 项目

**方法 A：使用 PropertySource 注解**

```java
@Configuration
@PropertySource("file:.env.alipay")
public class AlipayConfig {
    @Value("${ALIPAY_APP_ID}")
    private String appId;
    
    @Value("${ALIPAY_APP_PRIVATE_KEY}")
    private String appPrivateKey;
    
    // ... 其他配置
}
```

**方法 B：使用 dotenv 库**

```xml
<!-- pom.xml -->
<dependency>
    <groupId>io.github.cdimascio</groupId>
    <artifactId>java-dotenv</artifactId>
    <version>3.0.0</version>
</dependency>
```

```java
import io.github.cdimascio.dotenv.Dotenv;

public class AlipayConfig {
    static {
        Dotenv dotenv = Dotenv.load();
        System.setProperty("alipay.app.id", dotenv.get("ALIPAY_APP_ID"));
        System.setProperty("alipay.private.key", dotenv.get("ALIPAY_APP_PRIVATE_KEY"));
    }
}
```

---

## 📦 Spring Boot application.yml 配置

将以下配置加入 `application.yml` 或 `application-alipay.yml`：

```yaml
alipay:
  app-id: ${ALIPAY_APP_ID}
  app-name: AIStarEcoSystem
  
  # 密钥配置（从环境变量读取）
  app-private-key: ${ALIPAY_APP_PRIVATE_KEY}
  alipay-public-key: ${ALIPAY_PUBLIC_KEY}
  
  # 网关配置
  gateway-url: https://openapi.alipay.com/gateway.do
  notify-url: https://api.aibuzz.cn/api/alipay/notify
  return-url: https://aibuzz.cn/payment/return
  
  # 签名方式
  sign-type: RSA2
  charset: UTF-8
  format: JSON
  
  # 沙箱配置（测试）
  sandbox:
    enabled: false
    gateway-url: https://openapi-sandbox.dl.alipaydev.com/gateway.do
```

---

## 🧪 测试配置

### 使用沙箱环境测试

1. **启用沙箱模式**：在 `.env.alipay` 中设置
```env
ALIPAY_SANDBOX_ENABLED=true
```

2. **获取沙箱账户**：访问 [支付宝沙箱](https://sandbox.alipaydev.com)
   - 创建沙箱买家账户（用于测试支付）
   - 创建沙箱卖家账户（你的测试商户）

3. **验证配置**：
```bash
# 测试私钥和公钥是否正确对应
java -cp alipay-sdk.jar com.alipay.api.DefaultAlipayClient \
  -Dapp_id=2021006169613183 \
  -Dprivate_key_path=./alipay_app_private_key.txt
```

---

## 🔒 安全建议

| 安全措施 | 优先级 | 说明 |
|--------|--------|------|
| ✅ .gitignore 保护 | 🔴 必须 | 防止密钥泄露到 Git 仓库 |
| ✅ 环境变量隔离 | 🔴 必须 | 生产环境通过容器/CI-CD 注入密钥 |
| ✅ 密钥轮换机制 | 🟠 强烈推荐 | 定期更新应用密钥 |
| ✅ 回调验签 | 🔴 必须 | 验证支付宝回调的真实性 |
| ✅ HTTPS 通信 | 🔴 必须 | 所有与支付宝的通信必须 HTTPS |
| ✅ 日志脱敏 | 🟠 推荐 | 避免在日志中打印密钥或敏感信息 |

---

## 📚 相关资源

- [支付宝开放平台](https://open.alipay.com)
- [支付宝 Java SDK](https://github.com/alipay/alipay-sdk-java)
- [支付宝 API 文档](https://opendocs.alipay.com)
- [支付宝沙箱环境](https://sandbox.alipaydev.com)

---

## 🆘 常见问题

### Q: 密钥丢失了怎么办？
**A:** 可以在支付宝开发者平台重新生成密钥，但旧密钥会失效。需要更新配置文件并重新部署。

### Q: 回调地址 IP 被限制怎么办？
**A:** 在开发设置 → 服务器IP白名单中添加你的服务器 IP，或者配置固定的回调地址。

### Q: 如何区分沙箱和生产环境？
**A:** 通过环境变量 `ALIPAY_SANDBOX_ENABLED` 控制，或使用不同的 `application-sandbox.yml` 配置文件。

### Q: 密钥格式错误会怎样？
**A:** 会导致签名验证失败，表现为 `INVALID_SIGNATURE` 错误。检查密钥中是否有多余空格或换行符。

---

## ✅ 配置检查清单

- [ ] 已从支付宝平台获取应用私钥
- [ ] 已从支付宝平台获取支付宝公钥
- [ ] `.env.alipay` 文件已创建并填写了密钥
- [ ] `.gitignore` 已包含 `.env.alipay`
- [ ] Spring Boot 项目已加载环境变量
- [ ] 已测试沙箱环境支付流程
- [ ] 已部署生产环境的密钥注入机制
- [ ] 已验证异步回调地址可正常接收

---

**更新时间**: 2026-07-10  
**配置状态**: ✅ 基础配置完成，可开始后端开发
