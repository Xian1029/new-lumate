# Lumate

Lumate 是基于学习资料的 AI 学习系统，提供学习空间、教材解析、学习计划、AI Tutor、练习判题、笔记、闪卡、知识图谱和学习进度。前端使用 Next.js，后端使用 FastAPI，数据使用 SQLite 和 Docker 命名卷，后台任务使用 Redis。

## 一条命令部署

本地 Docker 和 Linux 服务器统一使用仓库根目录的 `linux.sh`、`docker-compose.deploy.yml` 及同一套 Dockerfile。这样两边的镜像构建和服务拓扑一致。两台机器的数据及密钥仍各自独立；需要一致的业务内容时须另行迁移数据。

环境要求：Docker Engine、Docker Compose v2、Python 3、可访问 Docker/npm/Python 依赖源以及所选云端模型 API 的网络。运行用户须有 Docker 权限。先检查：

```sh
docker info
docker compose version
python3 --version
```

首次部署：

```sh
git clone --branch main https://github.com/Xian1029/new-lumate.git
cd new-lumate
sh linux.sh
```

已有仓库更新：

```sh
git status --short
git pull --ff-only origin main
sh linux.sh
```

`linux.sh` 首次运行自动创建私有配置文件并生成登录签名密钥和加密密钥，随后校验配置、构建 API 和 Web 镜像、启动 Redis/API/Web 并等待全部服务健康。若事先配置了云端 Key，部署前会发起一次真实模型请求进行预检，可能产生少量费用。未配置 Key 时也可完成部署，管理员登录后在“平台 AI 设置”中配置。脚本不会执行 Git 操作、清空数据库或删除上传文件。代码更新后仍运行同一条命令；不要用开发专用的 `docker-compose.yml` 或 macOS 进程脚本 `start.sh` 对照线上效果。

## 配置

`deploy/.env.production` 已被 Git 忽略，不能提交到仓库。`linux.sh` 首次运行会以私有权限复制配置模板。部署程序会生成或保留 `JWT_SECRET_KEY`、`CSRF_SECRET_KEY` 和 `ENCRYPTION_KEY`；若已有数据卷，必须使用原加密密钥。管理员初始账号为 `admin`，初始密码为 `12345678`，首次登录必须修改。已存在的管理员密码不会因重新部署而重置。建议在首次部署后立即登录修改密码。

| 变量 | 说明 |
| --- | --- |
| `WEB_PORT` | Web 对外端口，默认 3003 |
| `API_PORT` | API 本机端口，默认 8001 |
| `CORS_ORIGINS` | 浏览器实际访问来源，例如 `http://localhost:3003` 或 `https://learn.example.com` |
| `APP_ENVIRONMENT` | 两边都用 `production` 才能保持部署模式一致 |
| `AUTH_ENABLED` / `DEPLOYMENT_MODE` | 生产模板默认 `true` / `multi_user`；旧单用户模式用 `false` / `single_user` |
| `JWT_SECRET_KEY` | 首次部署自动生成；多用户模式至少 32 字符，重启后保持不变 |
| `ADMIN_INITIAL_PASSWORD` | 默认 `12345678`；仅首次创建管理员时使用，首次登录必须修改 |
| `ENCRYPTION_KEY` | 已加密数据的 Fernet 密钥，必须备份和保持稳定 |
| `LLM_PROVIDER` / `LLM_MODEL` | AI 供应商及模型，例如 `deepseek` / `deepseek-chat` |
| `DEEPSEEK_API_KEY` 等 | 可选；配置后部署时测试服务，未配置则登录后在管理员页面设置 |

生产模板默认启用多用户。如需自定义初始密码或公开访问地址，可在首次运行后编辑 `deploy/.env.production`，再执行 `sh linux.sh`；修改已有安装的加密密钥会使旧数据无法解密。示例：

```dotenv
APP_ENVIRONMENT=production
AUTH_ENABLED=true
DEPLOYMENT_MODE=multi_user
CORS_ORIGINS=https://learn.example.com
ADMIN_INITIAL_PASSWORD=请替换为强密码
```

云端 AI Key 可以在部署前写入配置文件，也可以在管理员首次登录后通过前端设置；个人 Key 由各用户按管理员策略配置。预先写入 Key 时，部署会进行真实连通性测试；未写入 Key 时，基础学习页面可启动，AI 功能需等平台或个人 Key 配好后才能使用。支持 DeepSeek、OpenAI、Anthropic、OpenRouter、Gemini 和 Groq。不同环境应分别保管自己的 Key。不要公开配置文件、Compose 展开配置或 `docker inspect` 输出。

可显式指定配置：

```sh
sh linux.sh --env-file deploy/.env.production
```

如已在配置文件中设置云端 Key，想在终端更换供应商、模型或 Key，可运行 `sh linux.sh --configure`；脚本会隐藏输入的 Key 并在启动前验证。首次直接部署无需执行此操作。

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
2. 两边运行同一命令 `sh linux.sh`，使用同一份 `docker-compose.deploy.yml`。
3. 比较配置中的认证模式、模型、功能开关及依赖构建参数；密钥和地址可因环境不同而不同。
4. 两边分别检查三个服务健康，并在浏览器执行相同的业务验证。

镜像由同一份代码和 Dockerfile 构建，但外部基础镜像与依赖仓库可能更新。需要严格可重复构建时，还应固定基础镜像 digest 与依赖版本，并使用同一目标 CPU 架构。当前脚本保证部署流程一致，不宣称不同时间构建的镜像哈希必然相同。

## 备份、验证与排错

更新前备份 `deploy/.env.production`、数据卷和上传卷；SQLite 一致性备份应先暂停写入。卷的备份与恢复命令见 [DEPLOYMENT.md](DEPLOYMENT.md)。更新失败时保留原卷，查看日志并从上一个 Git 提交重建；部署脚本不会自动回滚镜像。

部署后至少验证：三个服务均为 `healthy`；能登录；学习空间、上传解析、AI 调用正常；重启后账号和数据仍在。健康检查只证明服务启动，不代表全部学习功能通过。若 `git pull` 因本地修改失败，先处理差异，不能继续把旧代码当作最新版本部署。

更多文档：[详细部署](DEPLOYMENT.md) · [功能说明](FEATURES.md) · [安全说明](SECURITY.md) · [贡献指南](CONTRIBUTING.md) · [许可证](LICENSE)。
