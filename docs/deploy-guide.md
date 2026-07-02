# KgEdu 部署指南

## 一、快速部署

### 前置条件

- 目标服务器安装 Ubuntu 20.04+ ，内存 ≥ 4GB
- 本地安装 Docker + SSH 客户端
- 阿里云容器镜像仓库已登录

### 一键部署

```bash
# 部署到新服务器（使用默认 课堂星 品牌）
./deploy-kgedu.sh 124.222.177.241 ubuntu

# 指定品牌
./deploy-kgedu.sh 124.222.177.241 ubuntu \
  --name "智课云枢" \
  --title "智课云枢智慧教学系统" \
  --logo-dark "/logo-zikeyunsu.svg" \
  --logo-light "/logo-zikeyunsu-light.svg" \
  --email "contact@zikeyunsu.com"
```

部署脚本会自动完成：
1. SSH 免密登录配置
2. Docker 安装（如未安装）
3. PostgreSQL 容器启动（数据不会覆盖）
4. 数据库迁移（幂等执行）
5. Nginx 反向代理启动
6. 品牌配置

---

## 二、品牌配置系统

品牌信息通过环境变量在运行时配置，无需重新构建 Docker 镜像。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BRANDING_APP_NAME` | 应用名称 | `课堂星` |
| `BRANDING_APP_TITLE` | 系统标题 | `智慧教学系统` |
| `BRANDING_APP_DESCRIPTION` | 应用描述 | `融合知识图谱与人工智能技术的智慧教学平台` |
| `BRANDING_LOGO_DARK` | 深色 Logo 路径 | `/logo.svg` |
| `BRANDING_LOGO_LIGHT` | 浅色 Logo 路径 | `/logo-light.svg` |
| `BRANDING_FAVICON` | 网站图标路径 | `/vite.svg` |
| `BRANDING_CONTACT_EMAIL` | 联系邮箱 | `demo@ketangxing.com` |

### 自定义 Logo

将 Logo 文件（SVG/PNG）放入 `kg-edu-vite-antd/public/` 目录并重新构建镜像：

```bash
# 放置自定义 Logo
cp my-logo.svg kg-edu-vite-antd/public/
cp my-logo-light.svg kg-edu-vite-antd/public/

# 构建并推送
./build-and-push.sh
```

---

## 三、超级管理员设置

### 创建超级管理员

超级管理员需要数据库中存在 `organizations` 表和 `tokens` 表。

**方式一：部署脚本自动创建（推荐）**

`deploy-kgedu.sh` 部署完成后，通过后端 API 创建：

```bash
curl -X POST http://<服务器IP>/rpc/run \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "register_super_admin",
    "tenant": "",
    "input": {
      "memberId": "superadmin",
      "name": "超级管理员",
      "password": "Admin@123456",
      "passwordConfirmation": "Admin@123456"
    }
  }'
```

> 此接口返回 500 是序列化 bug，但用户已成功创建。

**方式二：容器内 Elixir 脚本（更可靠）**

```bash
ssh ubuntu@<服务器IP> bash << 'REMOTE_EOF'
cat > /tmp/create_admin.exs << 'EOF'
{:ok, _} = Application.ensure_all_started(:kg_edu)
orgs = KgEdu.Repo.all!(KgEdu.Accounts.Organization)
target = if orgs == [], do: "public", else: hd(orgs).schema_name
KgEdu.Accounts.User
|> Ash.Changeset.for_action(:register_with_password, %{
  member_id: "superadmin", name: "超级管理员",
  password: "Admin@123456", password_confirmation: "Admin@123456",
  role: :super_admin
}) |> Ash.create(tenant: target)
EOF
cd /home/ubuntu/kg_edu
docker compose run --rm backend bin/kg_edu eval "$(cat /tmp/create_admin.exs)"
REMOTE_EOF
```

### 默认超级管理员

| 字段 | 值 |
|------|-----|
| 用户名 | `superadmin` |
| 密码 | `Admin@123456` |
| 角色 | `super_admin` |

### 登录

访问 `http://<服务器IP>/login?role=admin`，选择「管理员登录」。

进入管理后台后可在 `/admin/dashboard/organizations` 创建新租户（组织）。

---

## 四、常见问题

### Q1: 迁移文件重复名称

```
** (Ecto.MigrationError) migration name update_code is duplicated
```

两个文件 `20251021062531_update_code.exs` 和 `20251023125910_update_code.exs`
从文件名提取的 migration name 都是 `update_code`，导致重复。部署脚本会自动重命名第二个文件。

### Q2: 表不存在 (organizations / tokens / ...)

首次部署时，部分表（`organizations`、`tokens`）未被主迁移覆盖，部署脚本会通过 `CREATE TABLE IF NOT EXISTS` 自动创建。如果已存在则跳过。

### Q3: RPC 返回 Internal Server Error

`register_super_admin` 返回 500 是已知序列化 bug（Jason 不支持元组编码），不影响实际功能，用户已创建成功。正常登录走 `sign_in_tenant` 接口。

### Q4: Docker Hub 镜像拉取超时（国内服务器）

服务器已配置 Docker registry mirror (`docker.1ms.run`)，如仍有问题：

```bash
ssh ubuntu@<IP> "sudo tee /etc/docker/daemon.json << 'EOF'
{\"registry-mirrors\": [\"https://your-mirror.com\"]}
EOF
sudo systemctl restart docker"
```

### Q5: OrbStack Docker daemon 断开

```bash
orb restart
sleep 8
docker info
```

---

## 五、数据安全

1. 所有 SQL 使用 `CREATE ... IF NOT EXISTS`，不会覆盖已有数据
2. PostgreSQL 数据存储在 Docker volume，重启不丢失
3. 升级时仅更新应用容器，不触碰数据库
4. 备份：`docker compose exec db pg_dump -U postgres kg_edu_dev > backup.sql`
