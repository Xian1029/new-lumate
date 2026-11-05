# Lumate Web

独立的 Next.js 前端，仓库地址为 [Xian1029/lumate-web](https://github.com/Xian1029/lumate-web)。此目录可以单独构建，不需要 API 源码。

## 构建

```sh
API_UPSTREAM_URL=http://lumate-api:8000/api sh build.sh
```

`API_UPSTREAM_URL` 是 **Web 容器内部**访问 API 的地址，在构建镜像时写入 Next.js 的服务端代理配置。浏览器仍通过同源 `/api` 请求，不直接接触内部地址。若 API 地址改变，需重新构建 Web 镜像。

## 部署

复制 `.env.example` 为 `.env`，设置 `API_UPSTREAM_URL` 和 `WEB_PORT`，先部署 API，再运行 `sh deploy.sh`。同机部署时默认通过 `lumate-network` 访问 `http://lumate-api:8000/api`。Web 默认发布在 3003 端口。

切换现有组合式部署时先备份数据和上传卷，再停用旧组合式 Compose 容器；不要执行 `down -v`。Web 不挂载学习数据。
