# Lumate API

独立的 FastAPI 服务，仓库地址为 [Xian1029/lumate-api](https://github.com/Xian1029/lumate-api)。包含数据库迁移、上传解析、后台任务和 Redis；Docker 构建上下文只需要本目录。

## 构建

```sh
sh build.sh
```

## 部署

复制 `.env.example` 为 `.env`，配置 `ENCRYPTION_KEY`、`JWT_SECRET_KEY`、`CSRF_SECRET_KEY` 和实际的 `CORS_ORIGINS`，然后运行 `sh deploy.sh`。新环境可用 `openssl rand -hex 32` 分别生成两个签名密钥；Fernet 加密密钥需用 `python3 -c 'import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())'` 生成。

**已有 Lumate 数据卷时必须保留原 ENCRYPTION_KEY。** 先备份数据库和上传卷，再停用旧组合式 Compose 容器；不要执行 `down -v`。本 Compose 继续使用原命名卷 `lumate-customized_data`、`lumate-customized_uploads`、`lumate-customized_redis`，不会清空学习数据。

API 绑定 `127.0.0.1:8001`，Web 通过外部 Docker 网络 `lumate-network` 访问容器 `lumate-api:8000`。在不同主机部署时，需提供双方可达的 API 地址并配置 HTTPS、CORS 与网络访问策略。
