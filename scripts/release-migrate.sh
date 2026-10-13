#!/usr/bin/env bash
# yikecheng 专属 migrate 脚本：标准迁移流程（public + tenant）
# bin/migrate 只跑 public schema！tenant 迁移需走 migrate_tenants
set -e
REMOTE="root@47.99.245.49"

echo "==> Step 1: bin/migrate (public schema)"
ssh "$REMOTE" 'docker exec kg-edu-backend /app/bin/migrate'

echo ""
echo "==> Step 2: migrate_tenants() (release 标准 tenant 迁移流程)"
ssh "$REMOTE" 'docker exec kg-edu-backend /app/bin/kg_edu eval "KgEdu.Release.migrate_tenants()"'
