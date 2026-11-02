# Lumate

Lumate 是基于学习资料的 AI 学习系统，提供学习空间、教材解析、学习计划、AI Tutor、练习判题、笔记、闪卡、知识图谱和学习进度。前端使用 Next.js，后端使用 FastAPI，数据使用 SQLite 和 Docker 命名卷，后台任务使用 Redis。

## 一条命令部署

本地 Docker 和 Linux 服务器统一使用仓库根目录的 `docker-start.sh`、`docker-compose.deploy.yml` 及同一套 Dockerfile。这样两边的镜像构建和服务拓扑一致。两台机器的数据及密钥仍各自独立；需要一致的业务内容时须另行迁移数据。

环境要求：Docker Engine、Docker Compose v2、Python 3、可访问 Docker/npm/Python 依赖源以及所选云端模型 API 的网络。运行用户须有 Docker 权限。先检查：

```sh
docker info
docker compose version
python3 --version
```

首次部署：

```sh
git clone https://github.com/Xian1029/new-lumate.git
cd new-lumate
cp deploy/.env.production.example deploy/.env.production
# 编辑 deploy/.env.production，按下文设置模式、地址、密码和 AI Key
sh docker-start.sh
```

已有仓库更新：

```sh
git status --short
git pull --ff-only origin main
sh docker-start.sh
```

脚本会检查依赖、调用项目已有的部署程序，构建 API 和 Web 镜像、执行云端 AI 预检、启动 Redis/API/Web 并等待健康。脚本不会执行 Git 操作、清空数据库或删除上传文件。预检会发起一次真实模型请求，可能产生少量费用。代码更新后仍运行同一条命令；不要用开发专用的 `docker-compose.yml` 或 macOS 进程脚本 `start.sh` 对照线上效果。

## 配置

`deploy/.env.production` 已被 Git 忽略，不能提交到仓库。脚本首次运行会生成或保留 `CSRF_SECRET_KEY` 和 `ENCRYPTION_KEY`；若已有数据卷，必须使用原加密密钥。首次缺少浏览器访问地址或 AI Key 时，脚本会在终端交互询问，Key 输入不回显。也可提前写入配置文件供非交互部署。

| 变量 | 说明 |
| --- | --- |
| `WEB_PORT` | Web 对外端口，默认 3003 |
| `API_PORT` | API 本机端口，默认 8001 |
| `CORS_ORIGINS` | 浏览器实际访问来源，例如 `http://localhost:3003` 或 `https://learn.example.com` |
| `APP_ENVIRONMENT` | 两边都用 `production` 才能保持部署模式一致 |
| `AUTH_ENABLED` / `DEPLOYMENT_MODE` | 多用户用 `true` / `multi_user`；旧单用户模式用 `false` / `single_user` |
| `JWT_SECRET_KEY` | 多用户模式至少 32 字符，重启后保持不变 |
| `ADMIN_INITIAL_PASSWORD` | 首次创建管理员时的初始密码；重启不会重置已修改密码 |
| `ENCRYPTION_KEY` | 已加密数据的 Fernet 密钥，必须备份和保持稳定 |
| `LLM_PROVIDER` / `LLM_MODEL` | AI 供应商及模型，例如 `deepseek` / `deepseek-chat` |
| `DEEPSEEK_API_KEY` 等 | 部署预检使用的服务端 Key；应用内也可管理运行时 Key |

启用多用户时，首次运行前将以下变量写入配置文件：

```dotenv
APP_ENVIRONMENT=production
AUTH_ENABLED=true
DEPLOYMENT_MODE=multi_user
JWT_SECRET_KEY=请替换为至少32字符的随机字符串
ADMIN_INITIAL_PASSWORD=请替换为强密码
```

当前部署程序要求有效的云端 AI Key 完成预检。可配置 `DEEPSEEK_API_KEY`，或按提示输入；支持 DeepSeek、OpenAI、Anthropic、OpenRouter、Gemini 和 Groq。管理页面中的平台 Key 和个人 Key 属于应用运行时配置，不替代首次部署预检。不同环境应分别保管自己的 Key。不要公开配置文件、Compose 展开配置或 `docker inspect` 输出。

可显式指定配置：

```sh
sh docker-start.sh --env-file deploy/.env.production
```

同一台主机使用其他配置文件仍会操作同一组容器和数据卷，不能用配置文件名创建独立环境。切换认证模式前应先备份现有数据。

## 服务、端口与数据

Compose 项目固定为 `lumate-customized`，包含 `web`、`api`、`redis` 三个服务。默认 Web 地址是 `http://localhost:3003`，API 只绑定 `127.0.0.1:8001`，Redis 不发布端口。服务器公开访问建议使用 HTTPS 反向代理，并把 `CORS_ORIGINS` 设为实际 HTTPS 来源。域名、证书、反向代理和防火墙需另行配置。

SQLite、上传文件和 Redis 分别在 `lumate-customized_data`、`lumate-customized_uploads`、`lumate-customized_redis` 命名卷中。部署 Compose 不挂载源码；运行代码来自刚构建的镜像。删除容器不会删除卷，但 `docker compose down -v` 会删除卷，禁止在保留学习数据的环境执行。

查看状态、日志与健康检查：

```sh
docker compose --project-name lumate-customized --env-file deploy/.env.production -f docker-compose.deploy.yml ps
docker compose --project-name lumate-customized --env-file deploy/.env.production -f docker-compose.deploy.yml logs --tail=100 api web redis
curl -fsS http://127.0.0.1:8001/api/health/live
```

若修改端口或配置路径，命令中也要同步修改。

## 保持本地与线上一致

1. 两边检出同一个提交：`git rev-parse HEAD` 的结果应一致。
2. 两边运行同一命令 `sh docker-start.sh`，使用同一份 `docker-compose.deploy.yml`。
3. 比较配置中的认证模式、模型、功能开关及依赖构建参数；密钥和地址可因环境不同而不同。
4. 两边分别检查三个服务健康，并在浏览器执行相同的业务验证。

镜像由同一份代码和 Dockerfile 构建，但外部基础镜像与依赖仓库可能更新。需要严格可重复构建时，还应固定基础镜像 digest 与依赖版本，并使用同一目标 CPU 架构。当前脚本保证部署流程一致，不宣称不同时间构建的镜像哈希必然相同。

## 备份、验证与排错

更新前备份 `deploy/.env.production`、数据卷和上传卷；SQLite 一致性备份应先暂停写入。卷的备份与恢复命令见 [DEPLOYMENT.md](DEPLOYMENT.md)。更新失败时保留原卷，查看日志并从上一个 Git 提交重建；部署脚本不会自动回滚镜像。

部署后至少验证：三个服务均为 `healthy`；能登录；学习空间、上传解析、AI 调用正常；重启后账号和数据仍在。健康检查只证明服务启动，不代表全部学习功能通过。若 `git pull` 因本地修改失败，先处理差异，不能继续把旧代码当作最新版本部署。

更多文档：[详细部署](DEPLOYMENT.md) · [功能说明](FEATURES.md) · [安全说明](SECURITY.md) · [贡献指南](CONTRIBUTING.md) · [许可证](LICENSE)。
