# 小月积分

手机端浏览器使用的儿童积分管理系统，支持快捷加减分、手动加减分、设置总积分、快捷项管理和积分流水。

## 本地启动

```bash
cp .env.example .env
npm install
npm run dev
```

访问：

```text
http://localhost:3000
```

## Docker 启动

```bash
cp .env.example .env
docker compose up -d --build
```

默认连接外部 MySQL：

```text
192.168.1.100:13306
```

数据库名：

```text
xiaoyue_jifen
```

本地 `.env` 当前默认管理密码为 `xiaoyue123`，正式使用前请修改 `ADMIN_PASSWORD` 和 `SESSION_SECRET`。

应用启动时会自动创建数据库、数据表和默认快捷项。
