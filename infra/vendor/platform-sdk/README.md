# 固定版 Java SDK 制品

本目录只镜像 `pokocat/aibuzz-platform` 的 `java-sdk-v0.1.0` release 中的薄 Java SDK JAR/POM，不包含平台业务源码或凭据。来源仓库与本仓均为私有仓库；保留制品使新 CI runner 无需跨仓认证也能复现构建。

`infra/scripts/prepare-platform-sdk.sh` 先检查 Maven 缓存，再校验并安装本目录制品；没有随仓制品时才使用既有 GitHub release 下载路径。更新版本必须同时更新路径、脚本固定版本和 SHA256，不允许自动跟随 latest。哈希不符立即失败，不安装错误制品。

| 制品 | SHA256（与源 release digest 一致） |
| --- | --- |
| `0.1.0/platform-sdk-0.1.0.jar` | `e006985c833ed057fbb9aa258e572971445dc7f5e81b8dd242f74730d0337566` |
| `0.1.0/platform-sdk-0.1.0.pom` | `e277eccacda56ed92aba59014bf2a7a05bcf92e9a014ae0ee4a049e817721a2f` |

仓库 CI 和部署构建均先运行准备脚本。SDK 本身不包含生产配置，不会调用模型或修改用户权益。
