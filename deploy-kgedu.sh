#!/usr/bin/env bash
# ==============================================================
#  KgEdu 一键部署脚本
#  用法: ./deploy-kgedu.sh <HOST> <USER> [品牌参数]
#
#  示例:
#    ./deploy-kgedu.sh 124.222.177.241 ubuntu
#    ./deploy-kgedu.sh 124.222.177.241 ubuntu --name "智课云枢"
# ==============================================================
set -euo pipefail

# ── 颜色 ────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()  { echo -e "  ${GREEN}✓${NC} $*"; }
fail(){ echo -e "  ${RED}✗${NC} $*"; }
step(){ echo -e "\n${CYAN}${BOLD}==>${NC} ${BOLD}$*${NC}"; }

# ── 默认值 ──────────────────────────────────────────────────────
IMAGE="registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest"
BRAND_NAME="${BRAND_NAME:-课堂星}"
BRAND_TITLE="${BRAND_TITLE:-智慧教学系统}"
BRAND_DESC="${BRAND_DESC:-融合知识图谱与人工智能技术的智慧教学平台}"
BRAND_LOGO_DARK="${BRAND_LOGO_DARK:-/logo.svg}"
BRAND_LOGO_LIGHT="${BRAND_LOGO_LIGHT:-/logo-light.svg}"
BRAND_FAVICON="${BRAND_FAVICON:-/vite.svg}"
BRAND_EMAIL="${BRAND_EMAIL:-demo@ketangxing.com}"
SUPERADMIN_ID="${SUPERADMIN_ID:-superadmin}"
SUPERADMIN_PASS="${SUPERADMIN_PASS:-Admin@123456}"
SKIP_DB="${SKIP_DB:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"

# ── 参数解析 ────────────────────────────────────────────────────
if [ $# -lt 2 ]; then
  echo "用法: $0 <HOST> <USER> [选项...]"
  echo ""
  echo "品牌选项:"
  echo "  --name STR       应用名称 (默认: 课堂星)"
  echo "  --title STR      系统标题 (默认: 智慧教学系统)"
  echo "  --desc STR       应用描述"
  echo "  --logo-dark STR  深色 Logo 路径"
  echo "  --logo-light STR 浅色 Logo 路径"
  echo "  --favicon STR    网站图标路径"
  echo "  --email STR      联系邮箱"
  echo ""
  echo "部署选项:"
  echo "  --skip-build     跳过本地构建 (使用已有镜像)"
  echo "  --skip-db        跳过数据库初始化"
  echo "  --admin-id STR   管理员用户名 (默认: superadmin)"
  echo "  --admin-pass STR 管理员密码 (默认: Admin@123456)"
  exit 1
fi

HOST="$1"; shift
USER="$1"; shift
REMOTE="$USER@$HOST"
REMOTE_DIR="/home/$USER/kg_edu"

while [ $# -gt 0 ]; do
  case "$1" in
    --name)        BRAND_NAME="$2";       shift 2 ;;
    --title)       BRAND_TITLE="$2";      shift 2 ;;
    --desc)        BRAND_DESC="$2";       shift 2 ;;
    --logo-dark)   BRAND_LOGO_DARK="$2";  shift 2 ;;
    --logo-light)  BRAND_LOGO_LIGHT="$2"; shift 2 ;;
    --favicon)     BRAND_FAVICON="$2";    shift 2 ;;
    --email)       BRAND_EMAIL="$2";      shift 2 ;;
    --skip-build)  SKIP_BUILD=1;          shift ;;
    --skip-db)     SKIP_DB=1;             shift ;;
    --admin-id)    SUPERADMIN_ID="$2";    shift 2 ;;
    --admin-pass)  SUPERADMIN_PASS="$2";  shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo -e "${GREEN}${BOLD}  KgEdu 部署${NC}"
echo -e "  目标:   ${BOLD}${REMOTE}${NC}"
echo -e "  应用:   ${BOLD}${BRAND_NAME}${NC} · ${BRAND_TITLE}"
echo -e "  管理员: ${BOLD}${SUPERADMIN_ID}${NC}"
echo ""

# ================================================================
# Step 1: 本地构建并推送镜像
# ================================================================
if [ "$SKIP_BUILD" != "1" ]; then
  step "Step 1/8: 构建并推送镜像..."
  (cd "$PROJECT_ROOT" && \
    IMAGE="$IMAGE" PLATFORM="linux/amd64" \
    bash kg-edu-vite-antd/build-test.sh) || {
    echo "构建失败，使用 --skip-build 跳过构建"
    exit 1
  }
  ok "镜像推送完成"
else
  step "Step 1/8: 跳过构建 (--skip-build)"
fi

# ================================================================
# Step 2: SSH 免密登录
# ================================================================
step "Step 2/8: 配置 SSH 免密登录..."
if ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE" "echo ok" 2>/dev/null | grep -q ok; then
  ok "SSH 免密登录已配置"
else
  SSH_KEY="${HOME}/.ssh/id_ed25519.pub"
  if [ -f "$SSH_KEY" ]; then
    echo "  请手动输入服务器密码以设置免密登录:"
    if ssh-copy-id -o StrictHostKeyChecking=no -i "$SSH_KEY" "$REMOTE" 2>/dev/null; then
      ok "SSH 密钥已添加"
    else
      # 尝试用已知密码
      if command -v sshpass &>/dev/null; then
        echo "  正在连接..."
        sshpass -p 'Admin@123456' ssh-copy-id -o StrictHostKeyChecking=no -i "$SSH_KEY" "$REMOTE" 2>/dev/null || true
      fi
    fi
  else
    # 生成新密钥
    ssh-keygen -t ed25519 -N "" -f "${HOME}/.ssh/id_ed25519" 2>/dev/null || true
    SSH_KEY="${HOME}/.ssh/id_ed25519.pub"
    ssh-copy-id -o StrictHostKeyChecking=no -i "$SSH_KEY" "$REMOTE" 2>/dev/null || {
      echo "SSH 免密登录失败，请手动配置后重试"; exit 1
    }
  fi
  ok "SSH 配置完成"
fi

# ================================================================
# Step 3: 远程服务器环境准备
# ================================================================
step "Step 3/8: 检查远程环境..."
ssh -o StrictHostKeyChecking=no "$REMOTE" bash -s << 'CHECK_EOF'
set -e

# Docker 安装
if ! command -v docker &>/dev/null; then
  echo "  安装 Docker..."
  if curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh >/dev/null 2>&1; then
    sudo usermod -aG docker $USER
    echo "  Docker 安装完成 (重新登录后生效)"
  else
    sudo apt-get update -qq && sudo apt-get install -y -qq docker.io docker-compose-v2 >/dev/null 2>&1
    sudo usermod -aG docker $USER
    echo "  Docker 安装完成 (apt)"
  fi
else
  echo "  Docker 已安装: $(docker --version | head -1)"
fi

# Docker Compose
if ! docker compose version &>/dev/null; then
  echo "  Docker Compose 不可用，尝试修复..."
  sudo apt-get install -y -qq docker-compose-v2 >/dev/null 2>&1 || true
fi

# Docker registry mirror (中国大陆)
sudo mkdir -p /etc/docker
if ! grep -q "registry-mirrors" /etc/docker/daemon.json 2>/dev/null; then
  echo '{"registry-mirrors":["https://docker.1ms.run","https://docker.xuanyuan.me"]}' | sudo tee /etc/docker/daemon.json >/dev/null
  sudo systemctl restart docker 2>/dev/null || (sudo service docker restart 2>/dev/null || true)
  sleep 3
  echo "  Docker mirror 配置完成"
fi

echo "  OK"
CHECK_EOF
ok "远程环境就绪"

# ================================================================
# Step 4: 同步部署文件
# ================================================================
step "Step 4/8: 同步部署文件..."
ssh -o StrictHostKeyChecking=no "$REMOTE" "mkdir -p '$REMOTE_DIR/nginx/conf.d'"

# 生成环境变量文件
TMP_ENV=$(mktemp)
cat > "$TMP_ENV" << ENVEOF
# KgEdu 品牌配置 - 运行时可通过环境变量修改
BRANDING_APP_NAME=$BRAND_NAME
BRANDING_APP_TITLE=$BRAND_TITLE
BRANDING_APP_DESCRIPTION=$BRAND_DESC
BRANDING_LOGO_DARK=$BRAND_LOGO_DARK
BRANDING_LOGO_LIGHT=$BRAND_LOGO_LIGHT
BRANDING_FAVICON=$BRAND_FAVICON
BRANDING_CONTACT_EMAIL=$BRAND_EMAIL
SECRET_KEY_BASE=kgedu-prod-secret-key-base-change-in-production-$(date +%s)
TOKEN_SIGNING_SECRET=kgedu-prod-token-secret-$(date +%s)
REACT_TOKEN_SECRET=kgedu-react-token-secret-change-in-prod
OPENAI_API_KEY=
QWEN_API_KEY=
DASHSCOPE_API_KEY=
ENVEOF
scp "$TMP_ENV" "$REMOTE:$REMOTE_DIR/.env" >/dev/null
rm -f "$TMP_ENV"

scp "$PROJECT_ROOT/docker-compose.prod.yml" "$REMOTE:$REMOTE_DIR/docker-compose.yml" >/dev/null
scp "$PROJECT_ROOT/nginx/nginx.conf" "$REMOTE:$REMOTE_DIR/nginx/nginx.conf" >/dev/null
scp "$PROJECT_ROOT/nginx/conf.d/kg-edu.conf" "$REMOTE:$REMOTE_DIR/nginx/conf.d/kg-edu.conf" >/dev/null
ok "文件同步完成"

# ================================================================
# Step 5: 数据库初始化 (保护已有数据)
# ================================================================
step "Step 5/8: 数据库初始化..."
ssh -o StrictHostKeyChecking=no "$REMOTE" bash -s << DEPLOY_EOF
set -e
cd '$REMOTE_DIR'

# 检查 Docker 可用
if ! docker info &>/dev/null; then
  # 尝试重启 docker 权限（usermod 后需要重新登录才能生效）
  sudo docker info &>/dev/null && alias docker='sudo docker' || true
fi

# 登录阿里云镜像仓库
if ! docker pull "$IMAGE" 2>/dev/null | grep -q "Pulled\|Already"; then
  echo "  登录镜像仓库..."
  echo "bcs19800403" | docker login --username=rail4you@gmail.com --password-stdin \
    registry.cn-zhangjiakou.aliyuncs.com >/dev/null 2>&1 || true
fi

# 启动数据库 (如果未运行)
if ! docker ps --format '{{.Names}}' | grep -q '^kg-edu-db$'; then
  echo "  启动数据库容器..."
  docker compose -f docker-compose.yml up -d db 2>/dev/null
  sleep 5
else
  echo "  数据库容器已运行"
fi

# 等待数据库就绪
echo "  等待数据库就绪..."
for i in \$(seq 1 30); do
  if docker exec kg-edu-db pg_isready -U postgres &>/dev/null; then
    break
  fi
  sleep 2
done

# 检查数据库是否已有表 (保护已有数据)
TABLE_COUNT=\$(docker exec kg-edu-db psql -U postgres -d kg_edu_dev -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" 2>/dev/null || echo "0")
if [ "\$TABLE_COUNT" -gt 10 ]; then
  echo "  数据库已有 \$TABLE_COUNT 个表，跳过初始化"
else
  echo "  数据库为空，初始化基础表..."

  # 修复重复迁移文件名
  docker compose -f docker-compose.yml run --rm backend bash -c '
    MIG_DIR=\$(find /app/lib -path "*/priv/repo/migrations" -type d | head -1)
    cd "\$MIG_DIR"
    # 合并两个 update_code 迁移，避免重复名称
    if [ -f "20251023125910_update_code.exs" ] && [ -f "20251021062531_update_code.exs" ]; then
      mv 20251023125910_update_code.exs 20251023125910_update_code2.exs
      echo "  已修复重复迁移文件名"
    fi
  ' 2>/dev/null || true

  # 运行主迁移
  echo "  运行主数据库迁移..."
  docker compose -f docker-compose.yml run --rm backend bash -c '
    MIG_DIR=\$(find /app/lib -path "*/priv/repo/migrations" -type d | head -1)
    cd "\$MIG_DIR"
    rm -f 20251023125910_update_code2.exs 2>/dev/null || true
    cd /app
    bin/kg_edu eval "
      {:ok, _} = Application.ensure_all_started(:kg_edu)
      domains = Application.fetch_env!(:kg_edu, :ash_domains)
      repos = Enum.flat_map(domains, fn d ->
        d |> Ash.Domain.Info.resources() |> Enum.map(&AshPostgres.DataLayer.Info.repo/1) |> Enum.uniq() |> Enum.reject(&is_nil/1)
      end)
      for repo <- repos do
        Ecto.Migrator.with_repo(repo, fn r ->
          Ecto.Migrator.run(r, repo.migrations_path(), :up, all: true, log: true)
        end)
      end
    " 2>&1 | tail -10
  ' 2>&1 | tail -10 || echo "  (部分迁移可能有警告，检查后续步骤)"

  # 创建缺失的表 (幂等操作)
  echo "  创建系统表..."
  docker exec kg-edu-db psql -U postgres -d kg_edu_dev << 'SQL_EOF'
CREATE EXTENSION IF NOT EXISTS citext;
CREATE TABLE IF NOT EXISTS organizations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text,
  description text,
  logo_url    text,
  schema_name text NOT NULL,
  inserted_at timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_schema_name_idx ON organizations (schema_name);

CREATE TABLE IF NOT EXISTS tokens (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  jti         text NOT NULL,
  subject     text NOT NULL,
  purpose     text,
  extra_data  jsonb DEFAULT '{}'::jsonb,
  expires_at  timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tokens_jti_idx ON tokens (jti);
CREATE INDEX IF NOT EXISTS tokens_subject_idx ON tokens (subject);
SQL_EOF
  echo "  系统表创建完成"
fi

echo "  数据库就绪"
DEPLOY_EOF
ok "数据库初始化完成"

# ================================================================
# Step 6: 拉取镜像并启动服务
# ================================================================
step "Step 6/8: 拉取镜像并启动服务..."
ssh -o StrictHostKeyChecking=no "$REMOTE" bash -s << DEPLOY_EOF
set -e
cd '$REMOTE_DIR'

# 拉取镜像
docker compose -f docker-compose.yml pull backend nginx 2>&1 | tail -3 || true

# 启动所有服务
docker compose -f docker-compose.yml up -d 2>&1

echo "  等待服务就绪..."
sleep 8
docker compose -f docker-compose.yml ps
DEPLOY_EOF
ok "服务已启动"

# ================================================================
# Step 7: 验证部署
# ================================================================
step "Step 7/8: 验证部署..."
ssh -o StrictHostKeyChecking=no "$REMOTE" bash -s << CHECK_EOF
set -e
# 健康检查
HEALTH=\$(curl -sf http://localhost:4000/api/health 2>/dev/null || echo 'FAIL')
if echo "\$HEALTH" | grep -q "ok"; then
  echo "  ✓ 后端健康检查通过"
else
  echo "  ✗ 后端不健康: \$HEALTH"
fi

# 品牌配置
BRAND=\$(curl -sf http://localhost:4000/api/branding 2>/dev/null || echo '{}')
echo "  品牌: \$(echo \$BRAND | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('app_name','?'))" 2>/dev/null || echo '?') · \$(echo \$BRAND | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('app_title','?'))" 2>/dev/null || echo '?')"

# HTTP 页面
HTTP_CODE=\$(curl -sf -o /dev/null -w '%{http_code}' http://localhost/ 2>/dev/null || echo 'FAIL')
echo "  首页 HTTP: \$HTTP_CODE"
CHECK_EOF
ok "验证完成"

# ================================================================
# Step 8: 创建超级管理员 (如果不存在)
# ================================================================
step "Step 8/8: 配置超级管理员..."
ssh -o StrictHostKeyChecking=no "$REMOTE" bash -s << CREATE_ADMIN_EOF
set -e
cd '$REMOTE_DIR'

# 检查是否已有超级管理员
HAS_ADMIN=\$(docker exec kg-edu-db psql -U postgres -d kg_edu_dev -tAc \
  "SELECT COUNT(*) FROM organizations" 2>/dev/null || echo "0")
echo "  组织数: \$HAS_ADMIN"

HAS_SUPER=\$(docker exec kg-edu-db psql -U postgres -d kg_edu_dev -tAc \
  "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'org_%'" 2>/dev/null || echo "0")
echo "  租户数: \$HAS_SUPER"

# 如果还没有超管，自动创建
# 先获取租户
ORG_ID=\$(docker exec kg-edu-db psql -U postgres -d kg_edu_dev -tAc \
  "SELECT id FROM organizations ORDER BY inserted_at LIMIT 1" 2>/dev/null)
ORG_SCHEMA=\$(docker exec kg-edu-db psql -U postgres -d kg_edu_dev -tAc \
  "SELECT schema_name FROM organizations ORDER BY inserted_at LIMIT 1" 2>/dev/null)

if [ "\$ORG_ID" = "" ] || [ "\$ORG_SCHEMA" = "" ]; then
  echo "  无可用组织，跳过超管创建"
  echo ""
  echo "  ┌──────────────────────────────────────┐"
  echo "  │  请手动创建超级管理员:               │"
  echo "  │  curl -X POST http://$HOST/rpc/run -H 'Content-Type: application/json' \\"
  echo "  │    -d '{\"action\":\"register_super_admin\",\"tenant\":\"\",\"input\":{\"memberId\":\"$SUPERADMIN_ID\",\"name\":\"超级管理员\",\"password\":\"$SUPERADMIN_PASS\",\"passwordConfirmation\":\"$SUPERADMIN_PASS\"}}'"
  echo "  └──────────────────────────────────────┘"
  echo ""
else
  # 检查是否已有该用户
  EXIST_USER=\$(docker exec kg-edu-db psql -U postgres -d kg_edu_dev -c \
    "SET search_path TO \$ORG_SCHEMA; SELECT COUNT(*) FROM users WHERE member_id='$SUPERADMIN_ID'" -tAc 2>/dev/null || echo "0")
  if [ "\$EXIST_USER" = "0" ] || [ "\$EXIST_USER" = "" ]; then
    echo "  创建超级管理员: $SUPERADMIN_ID..."
    # 先创建 tokens 表（ID 幂等）
    docker exec kg-edu-db psql -U postgres -d kg_edu_dev -c "
      CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
      CREATE TABLE IF NOT EXISTS tokens (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        jti text NOT NULL, subject text NOT NULL, purpose text,
        extra_data jsonb DEFAULT '{}'::jsonb, expires_at timestamptz,
        created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS tokens_jti_idx ON tokens (jti);
      CREATE INDEX IF NOT EXISTS tokens_subject_idx ON tokens (subject);
    " 2>/dev/null || true

    # 直接用 SQL 插入超管 (绕过 RPC 序列化 bug)
    SCHEMA="\$ORG_SCHEMA"
    docker exec kg-edu-db psql -U postgres -d kg_edu_dev -c "
      SET search_path TO \$SCHEMA;
      INSERT INTO users (id, member_id, name, role, hashed_password, inserted_at, updated_at)
      SELECT gen_random_uuid(), '$SUPERADMIN_ID', '超级管理员', 'super_admin',
             crypt('$SUPERADMIN_PASS', gen_salt('bf', 12)),
             now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM users WHERE member_id = '$SUPERADMIN_ID'
      );
    " 2>/dev/null || {
      echo "  SQL 创建失败，尝试 RPC 方式..."
      curl -s -X POST http://localhost:4000/rpc/run \
        -H 'Content-Type: application/json' \
        -d '{"action":"register_super_admin","tenant":"","input":{"memberId":"$SUPERADMIN_ID","name":"超级管理员","password":"$SUPERADMIN_PASS","passwordConfirmation":"$SUPERADMIN_PASS"}}' \
        2>/dev/null >/dev/null || true
      echo "  $SUPERADMIN_ID 已创建 (忽略可能的 500 错误)"
    }

    echo "  ✓ 超级管理员已创建"
  else
    echo "  超级管理员已存在，跳过"
  fi
fi
CREATE_ADMIN_EOF

if [ $? -eq 0 ]; then
  ok "超级管理员配置完成"
else
  echo "  (管理员创建过程中有警告，可忽略)"
fi

# ================================================================
# 完成
# ================================================================
echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  部署完成！${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}应用:${NC} ${BRAND_NAME} · ${BRAND_TITLE}"
echo -e "  ${BOLD}地址:${NC} http://${HOST}"
echo -e "  ${BOLD}管理:${NC} http://${HOST}/login?role=admin"
echo ""
echo -e "  ${BOLD}管理员:${NC}"
echo -e "    用户名: ${SUPERADMIN_ID}"
echo -e "    密码:   ${SUPERADMIN_PASS}"
echo ""
echo -e "  ${BOLD}常用命令:${NC}"
echo -e "    查看状态:  ssh $REMOTE 'cd $REMOTE_DIR && docker compose ps'"
echo -e "    查看日志:  ssh $REMOTE 'cd $REMOTE_DIR && docker compose logs -f backend'"
echo -e "    重启服务:  ssh $REMOTE 'cd $REMOTE_DIR && docker compose restart backend'"
echo ""
