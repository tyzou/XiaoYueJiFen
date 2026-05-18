# 儿童积分系统开发文档

## 1. 项目概述

本项目是一个家庭自用的儿童积分管理系统，面向手机浏览器访问。家长可以快速加分、快速减分、手动录入积分变化、设置当前总积分、管理快捷项，并查看完整积分流水。

系统按单家庭、单儿童、单管理密码设计。

## 2. 技术栈

- 后端：Node.js + Express
- 页面：EJS 服务端渲染
- 数据库：MySQL
- 会话：express-session
- 部署：Docker
- 页面风格：移动端优先、可爱风格、圆角卡片、柔和配色

## 3. 数据库配置

数据库连接信息：

```env
MYSQL_HOST=192.168.1.100
MYSQL_PORT=13306
MYSQL_USER=root
MYSQL_PASSWORD=mysql_aiRnhA
MYSQL_DATABASE=xiaoyue_jifen
```

服务时区建议配置：

```env
TZ=Asia/Shanghai
```

数据库名称由项目生成：

```text
xiaoyue_jifen
```

应用启动时会自动执行初始化逻辑：

- 创建数据库。
- 创建数据表。
- 初始化当前积分为 `0`。
- 插入默认快捷项。

## 4. 核心功能

### 4.1 登录

- 使用一个管理密码登录。
- 管理密码从 `ADMIN_PASSWORD` 环境变量读取。
- 当前本地 `.env` 默认管理密码为 `xiaoyue123`，正式使用前建议修改。
- 未登录访问系统页面会跳转到 `/login`。
- 支持退出登录。

### 4.2 首页积分管理

- 显示当前总积分。
- 展示快捷加分和快捷减分按钮。
- 支持手动输入分值和原因。
- 支持设置总积分。

### 4.3 快捷加分 / 减分

- 快捷项可自定义名称、分值、图标、排序和启用状态。
- 加分项保存正数，减分项保存负数。
- 首页只展示启用的快捷项。
- 点击快捷项后写入积分流水并更新当前总分。

### 4.4 手动加减分

- 输入正数表示加分。
- 输入负数表示减分。
- 必须填写原因。
- 操作后生成流水。

### 4.5 设置总积分

- 输入目标总积分。
- 系统自动计算目标分数与当前分数的差值。
- 生成一条 `adjust` 校准流水。
- 不会静默覆盖历史。

### 4.6 积分流水

每条流水记录：

- 时间
- 操作类型
- 积分变化
- 原因
- 来源
- 操作后总分

## 5. 数据表

### settings

保存系统配置和当前积分。

```sql
CREATE TABLE settings (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### quick_items

保存快捷项。

```sql
CREATE TABLE quick_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  points INT NOT NULL,
  type ENUM('add', 'subtract') NOT NULL,
  icon VARCHAR(20),
  sort_order INT DEFAULT 0,
  enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### score_transactions

保存积分流水。

```sql
CREATE TABLE score_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  type ENUM('add', 'subtract', 'adjust') NOT NULL,
  points_delta INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  source ENUM('quick', 'manual', 'adjust') NOT NULL,
  quick_item_id BIGINT NULL,
  balance_after INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_score_transactions_quick_item
    FOREIGN KEY (quick_item_id)
    REFERENCES quick_items(id)
    ON DELETE SET NULL
);
```

## 6. 路由

- `GET /login`：登录页
- `POST /login`：登录提交
- `POST /logout`：退出登录
- `GET /`：首页
- `POST /score/quick/:id`：执行快捷项
- `POST /score/manual`：手动加减分
- `POST /score/adjust`：设置总积分
- `GET /quick-items`：快捷项管理
- `POST /quick-items`：新增快捷项
- `POST /quick-items/:id`：编辑快捷项
- `POST /quick-items/:id/delete`：删除快捷项
- `GET /transactions?days=7|14|30`：积分流水和指定周期统计

## 7. 部署

使用外部 MySQL，Docker 只启动 Node 应用。

```bash
cp .env.example .env
docker compose up -d --build
```

访问：

```text
http://服务器IP:3000
```

## 8. 测试清单

- 未登录访问首页会跳转登录页。
- 正确密码可以登录。
- 快捷加分会增加总积分并生成流水。
- 快捷减分会减少总积分并生成流水。
- 手动加减分会记录原因。
- 设置总积分会生成校准流水。
- 快捷项新增、编辑、删除后首页展示正确。
- Docker 重启后数据仍存在。
- 手机端页面无横向滚动，按钮易点击。
