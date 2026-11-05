# API 与 Web 独立部署

两个源码目录可以分别发布为 Git 仓库。构建上下文分别是 API 目录和 Web 目录；Web 构建不读取 API 源码，API 构建也不读取 Web 源码。

提交代码后可在原仓库运行 `sh scripts/export_split_packages.sh`，得到两个独立源码 tar.gz。归档仅包含 Git 已跟踪文件，不包含本地 `.env`、数据库、上传文件和构建缓存。

## 新安装

1. 在 API 目录复制 `.env.example` 为 `.env`。填写稳定的 `ENCRYPTION_KEY`、`JWT_SECRET_KEY`、`CSRF_SECRET_KEY` 和实际的 `CORS_ORIGINS`。密钥生成方式见 API README。不要提交 `.env`。
2. 执行 `sh deploy.sh`，等待 API 和 Redis 健康。
3. 在 Web 目录复制 `.env.example` 为 `.env`。同机部署使用 `API_UPSTREAM_URL=http://lumate-api:8000/api`；不同主机需填写 Web 容器能够访问的 API HTTPS 地址。
4. 执行 `sh deploy.sh`，等待 Web 健康。默认访问 `http://localhost:3003`。

## 现有组合式安装切换

1. 备份数据库、上传卷和原部署配置。API 新 `.env` 中的 `ENCRYPTION_KEY`、`JWT_SECRET_KEY`、`CSRF_SECRET_KEY` 必须与原安装一致，`CORS_ORIGINS` 要包含实际 Web 来源。
2. 确认两个独立镜像已构建，且 API 新配置校验通过。不要先删除旧镜像或数据卷。
3. 在旧仓库运行 `docker compose -f docker-compose.deploy.yml down`，**不要加 `-v`**。
4. 分别在 API、Web 目录运行 `sh deploy.sh`。新 API Compose 沿用原数据、上传和 Redis 命名卷。
5. 检查 API `/api/health/live`、Web 首页、登录、已有学习空间、上传文件与 AI 配置。

## 分别更新

API 改动只在 API 仓库运行 `sh deploy.sh`；Web 改动只在 Web 仓库运行 `sh deploy.sh`。Web 的 `API_UPSTREAM_URL` 在构建时进入 Next.js 代理配置；修改该地址需重建 Web 镜像。两个服务应有独立版本标签，部署前先记录当前镜像标签，便于回退。不要执行 `docker compose down -v`。

旧的组合式 `linux.sh` 与 `docker-compose.deploy.yml` 保留，供尚未迁移的安装继续使用。独立 Compose 使用不同的容器名，不应与组合式容器同时启动在同一端口。
