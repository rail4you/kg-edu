#!/bin/bash

# dev.sh - 项目服务管理脚本
# 管理三个项目的启动、停止、状态查看和日志

set -e

# 项目路径配置
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/kg-edu-vite-antd"
BACKEND_DIR="$PROJECT_ROOT/backend/kg_edu"
AGENT_DIR="$PROJECT_ROOT/ai-agent/KgAgent"
AGENT_SERVER_DIR="$PROJECT_ROOT/agent-server"

# PID文件目录
PID_DIR="$PROJECT_ROOT/.dev-pids"
LOG_DIR="$PROJECT_ROOT/.dev-logs"

# 服务名称
FRONTEND="frontend"
BACKEND="backend"
AGENT="agent"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 初始化目录
init_dirs() {
    mkdir -p "$PID_DIR" "$LOG_DIR"
}

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取服务PID
get_pid() {
    local service=$1
    local pid_file="$PID_DIR/$service.pid"
    if [ -f "$pid_file" ]; then
        cat "$pid_file"
    fi
}

# 检查服务是否运行
is_running() {
    local service=$1
    local pid=$(get_pid $service)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        return 0
    fi
    return 1
}

# ============================================================
# 进程清理工具
# ============================================================

# 杀掉整个进程树（包括所有子进程）
kill_tree() {
    local pid=$1
    local signal=${2:-TERM}

    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        return 0
    fi

    # 获取所有子进程 PID
    local children=$(pgrep -P "$pid" 2>/dev/null || true)
    for child in $children; do
        kill_tree "$child" "$signal"
    done

    kill "-$signal" "$pid" 2>/dev/null || true
}

# 清理所有残留的开发服务进程（僵尸进程、端口占用等）
cleanup_orphan_processes() {
    log_info "清理残留进程..."

    # 1. 清理僵尸 bun dev 进程（UE 状态的进程）
    local zombie_pids=$(ps aux | grep -E "bun.*(run dev|run dev:server|--watch server\.ts)" | grep -v grep | grep -v Craft | awk '{print $2}')
    if [ -n "$zombie_pids" ]; then
        echo "$zombie_pids" | xargs kill -9 2>/dev/null || true
        log_info "  已清理残留 bun dev 进程"
    fi

    # 2. 清理占用开发端口的进程
    local port_pids=""
    for port in 8081 3000 4000 5000 5001; do
        local pids=$(lsof -ti :$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            port_pids="$port_pids $pids"
        fi
    done
    if [ -n "$port_pids" ]; then
        echo "$port_pids" | tr ' ' '\n' | sort -u | xargs kill -9 2>/dev/null || true
        log_info "  已清理端口占用进程 (8081, 3000, 4000, 5000, 5001)"
    fi

    # 3. 清理孤立的 vite/esbuild 进程（不在当前 PID 树下的）
    local stale_vite=$(ps aux | grep -E "(vite|esbuild)" | grep -v grep | grep "$FRONTEND_DIR\|$BACKEND_DIR" | awk '{print $2}')
    if [ -n "$stale_vite" ]; then
        echo "$stale_vite" | xargs kill -9 2>/dev/null || true
        log_info "  已清理残留 vite/esbuild 进程"
    fi

    sleep 1
}

# ============================================================
# 停止服务（带完整进程树清理）
# ============================================================

# 停止单个服务（杀掉整个进程树）
stop_service() {
    local service=$1
    local service_name=$2
    local pid=$(get_pid $service)

    if [ -z "$pid" ]; then
        log_warn "$service_name 服务未运行"
        return 0
    fi

    if kill -0 "$pid" 2>/dev/null; then
        log_info "停止 $service_name 服务 (PID: $pid)..."

        # 先尝试优雅关闭整个进程树
        kill_tree "$pid" TERM

        # 等待进程结束
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ $count -lt 5 ]; do
            sleep 1
            ((count++))
        done

        # 如果还在运行，强杀整个进程树
        if kill -0 "$pid" 2>/dev/null; then
            log_warn "强制结束 $service_name 服务..."
            kill_tree "$pid" KILL
            sleep 1
        fi

        rm -f "$PID_DIR/$service.pid"
        log_success "$service_name 服务已停止"
    else
        log_warn "$service_name 服务未运行"
        rm -f "$PID_DIR/$service.pid"
    fi
}

stop_frontend() {
    stop_service $FRONTEND "前端"
    # 额外清理 vite 和 dev:server 子进程
    local vite_pids=$(ps aux | grep -E "vite.*8081" | grep -v grep | awk '{print $2}')
    [ -n "$vite_pids" ] && echo "$vite_pids" | xargs kill -9 2>/dev/null || true
    local devsrv_pids=$(ps aux | grep "bun.*--watch server\.ts" | grep "$FRONTEND_DIR" | grep -v grep | awk '{print $2}')
    [ -n "$devsrv_pids" ] && echo "$devsrv_pids" | xargs kill -9 2>/dev/null || true
}

stop_backend() {
    stop_service $BACKEND "后端"
    # 额外清理 mix/phx 子进程
    local phx_pids=$(ps aux | grep -E "mix.*phx\.server" | grep "$BACKEND_DIR" | grep -v grep | awk '{print $2}')
    [ -n "$phx_pids" ] && echo "$phx_pids" | xargs kill -9 2>/dev/null || true
    local esbuild_pids=$(ps aux | grep "esbuild" | grep "$BACKEND_DIR" | grep -v grep | awk '{print $2}')
    [ -n "$esbuild_pids" ] && echo "$esbuild_pids" | xargs kill -9 2>/dev/null || true
}

stop_agent() {
    stop_service $AGENT "AI Agent"
    local dotnet_pids=$(ps aux | grep "dotnet.*KgAgent" | grep -v grep | awk '{print $2}')
    [ -n "$dotnet_pids" ] && echo "$dotnet_pids" | xargs kill -9 2>/dev/null || true
}

stop_all() {
    log_info "停止所有服务..."
    stop_frontend
    stop_backend
    stop_agent
    log_success "所有服务已停止"
}

# ============================================================
# 启动服务
# ============================================================

# 启动前端服务
start_frontend() {
    log_info "启动前端服务..."
    if is_running $FRONTEND; then
        log_warn "前端服务已在运行中 (PID: $(get_pid $FRONTEND))"
        return 0
    fi

    init_dirs
    cd "$FRONTEND_DIR"

    # 清空日志
    > "$LOG_DIR/$FRONTEND.log"

    # 启动 API Server (bun --watch server.ts) 在后台
    nohup bun --watch server.ts >> "$LOG_DIR/$FRONTEND.log" 2>&1 &
    local api_pid=$!

    # 使用 npx vite 而不是 bun run dev，避免 bun 导致的僵尸进程问题
    nohup npx vite --port 8081 >> "$LOG_DIR/$FRONTEND.log" 2>&1 &
    local vite_pid=$!

    # 记录主 PID（vite 进程）
    echo $vite_pid > "$PID_DIR/$FRONTEND.pid"
    # 同时记录 api server PID 用于清理
    echo $api_pid > "$PID_DIR/${FRONTEND}-api.pid"

    sleep 3

    # 验证两个服务都启动成功
    local vite_ok=false
    local api_ok=false

    if kill -0 "$vite_pid" 2>/dev/null; then
        vite_ok=true
    fi
    if kill -0 "$api_pid" 2>/dev/null; then
        api_ok=true
    fi

    # 也检查端口
    if ! $vite_ok; then
        local vp=$(lsof -ti :8081 2>/dev/null || true)
        if [ -n "$vp" ]; then
            vite_ok=true
            echo "$vp" | head -1 > "$PID_DIR/$FRONTEND.pid"
        fi
    fi
    if ! $api_ok; then
        local ap=$(lsof -ti :3000 2>/dev/null || true)
        if [ -n "$ap" ]; then
            echo "$ap" | head -1 > "$PID_DIR/${FRONTEND}-api.pid"
        fi
    fi

    if $vite_ok; then
        log_success "前端服务已启动"
        log_info "  - Vite Dev Server: http://localhost:8081 (PID: $(cat $PID_DIR/$FRONTEND.pid))"
        log_info "  - API Server: http://localhost:3000"
    else
        log_error "前端服务启动失败，请查看日志: $LOG_DIR/$FRONTEND.log"
        log_info "  尝试运行: $0 cleanup 后重新启动"
        return 1
    fi
}

# 启动后端服务
start_backend() {
    log_info "启动后端服务..."
    if is_running $BACKEND; then
        log_warn "后端服务已在运行中 (PID: $(get_pid $BACKEND))"
        return 0
    fi

    init_dirs
    cd "$BACKEND_DIR"

    # 清空日志
    > "$LOG_DIR/$BACKEND.log"

    # 先执行数据库迁移
    log_info "执行数据库迁移..."
    mix ash.migrate >> "$LOG_DIR/$BACKEND.log" 2>&1 || true
    mix ash.migrate --tenants >> "$LOG_DIR/$BACKEND.log" 2>&1 || true

    # 启动 Phoenix 服务器
    nohup mix phx.server >> "$LOG_DIR/$BACKEND.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/$BACKEND.pid"

    # 等待后端就绪（检查端口 4000）
    local count=0
    while [ $count -lt 30 ]; do
        if curl -s -o /dev/null http://localhost:4000/ 2>/dev/null; then
            break
        fi
        if ! kill -0 "$pid" 2>/dev/null; then
            break
        fi
        sleep 1
        ((count++))
    done

    if is_running $BACKEND; then
        log_success "后端服务已启动 (PID: $pid)"
        log_info "  - Phoenix Server: http://localhost:4000"
    else
        log_error "后端服务启动失败，请查看日志: $LOG_DIR/$BACKEND.log"
        return 1
    fi
}

# 启动 AI Agent 服务
start_agent() {
    log_info "启动 AI Agent 服务 (Pi SDK)..."
    if is_running $AGENT; then
        log_warn "AI Agent 服务已在运行中 (PID: $(get_pid $AGENT))"
        return 0
    fi

    init_dirs
    cd "$AGENT_SERVER_DIR"

    # 清空日志
    > "$LOG_DIR/$AGENT.log"

    nohup bun run src/server.ts >> "$LOG_DIR/$AGENT.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/$AGENT.pid"

    sleep 3
    if is_running $AGENT; then
        log_success "AI Agent 服务已启动 (PID: $pid)"
        log_info "  - Agent Server: http://localhost:5050"
    else
        log_error "AI Agent 服务启动失败，请查看日志: $LOG_DIR/$AGENT.log"
        return 1
    fi
}

# 启动所有服务
start_all() {
    log_info "启动所有服务..."
    start_backend
    start_agent
    start_frontend
    log_success "所有服务已启动"
}

# ============================================================
# 状态与日志
# ============================================================

# 查看服务状态
status_service() {
    local service=$1
    local service_name=$2
    local port=$3
    local pid=$(get_pid $service)

    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        local port_status=""
        if [ -n "$port" ]; then
            if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/" 2>/dev/null | grep -qE "^[0-9]+$"; then
                port_status="${GREEN}端口正常${NC}"
            else
                port_status="${YELLOW}端口未响应${NC}"
            fi
        fi
        echo -e "$service_name: ${GREEN}运行中${NC} (PID: $pid) $port_status"
    else
        echo -e "$service_name: ${RED}未运行${NC}"
        if [ -f "$PID_DIR/$service.pid" ]; then
            rm -f "$PID_DIR/$service.pid"
        fi
    fi
}

# 查看所有服务状态
status_all() {
    echo "=========================================="
    echo "           服务状态"
    echo "=========================================="
    status_service $FRONTEND "前端 (Frontend)" 8081
    status_service $BACKEND "后端 (Backend)" 4000
    status_service $AGENT "AI Agent" 5000
    echo "=========================================="
}

# 查看日志
view_logs() {
    local service=$1
    local log_file="$LOG_DIR/$service.log"

    if [ ! -f "$log_file" ]; then
        log_error "日志文件不存在: $log_file"
        return 1
    fi

    log_info "查看 $service 日志 (Ctrl+C 退出)..."
    tail -f "$log_file"
}

# ============================================================
# 开发工具命令
# ============================================================

# 生成 Ash API (后端专用)
codegen() {
    local task=$1
    if [ -z "$task" ]; then
        log_error "请指定 codegen 任务名称"
        log_info "用法: $0 codegen <task_name>"
        return 1
    fi

    cd "$BACKEND_DIR"
    log_info "执行 mix ash.codegen $task..."
    mix ash.codegen "$task"
    log_success "API 代码生成完成"
}

# 执行数据库迁移
migrate() {
    cd "$BACKEND_DIR"
    log_info "执行数据库迁移..."
    mix ash.migrate
    mix ash.migrate --tenants
    log_success "数据库迁移完成"
}

# 完全清理并重建
clean_restart() {
    log_info "完全清理并重启..."
    stop_all
    cleanup_orphan_processes
    sleep 1
    start_all
}

# 查看帮助
show_help() {
    echo "用法: $0 <command> [service] [options]"
    echo ""
    echo "命令:"
    echo "  start [service]      启动服务 (不指定则启动所有)"
    echo "  stop [service]       停止服务 (不指定则停止所有)"
    echo "  restart [service]    重启服务 (不指定则重启所有)"
    echo "  status               查看所有服务状态"
    echo "  logs <service>       查看服务日志"
    echo "  cleanup              清理所有残留/僵尸进程"
    echo "  clean-restart        完全清理后重启 (推荐在构建后使用)"
    echo "  codegen <task>       生成 Ash API 代码 (后端专用)"
    echo "  migrate              执行数据库迁移 (后端专用)"
    echo ""
    echo "服务名称:"
    echo "  frontend  - 前端服务 (Vite + API Server)"
    echo "  backend   - 后端服务 (Phoenix)"
    echo "  agent     - AI Agent 服务 (.NET)"
    echo "  all       - 所有服务"
    echo ""
    echo "示例:"
    echo "  $0 start             # 启动所有服务"
    echo "  $0 start frontend    # 只启动前端服务"
    echo "  $0 stop all          # 停止所有服务"
    echo "  $0 clean-restart     # 构建后推荐使用，清理残留进程后重启"
    echo "  $0 cleanup           # 仅清理残留进程"
    echo "  $0 status            # 查看服务状态"
    echo "  $0 logs backend      # 查看后端日志"
    echo "  $0 codegen user      # 生成 user 相关的 Ash API"
    echo "  $0 migrate           # 执行数据库迁移"
}

# 主函数
main() {
    local command=${1:-help}
    local service=${2:-all}

    case $command in
        start)
            init_dirs
            case $service in
                frontend) start_frontend ;;
                backend) start_backend ;;
                agent) start_agent ;;
                all) start_all ;;
                *) log_error "未知服务: $service"; show_help; exit 1 ;;
            esac
            ;;
        stop)
            case $service in
                frontend) stop_frontend ;;
                backend) stop_backend ;;
                agent) stop_agent ;;
                all) stop_all ;;
                *) log_error "未知服务: $service"; show_help; exit 1 ;;
            esac
            ;;
        restart)
            case $service in
                frontend) stop_frontend; start_frontend ;;
                backend) stop_backend; start_backend ;;
                agent) stop_agent; start_agent ;;
                all) stop_all; cleanup_orphan_processes; start_all ;;
                *) log_error "未知服务: $service"; show_help; exit 1 ;;
            esac
            ;;
        status)
            status_all
            ;;
        logs)
            if [ -z "$service" ] || [ "$service" = "all" ]; then
                log_error "请指定服务名称: frontend, backend 或 agent"
                exit 1
            fi
            view_logs $service
            ;;
        cleanup)
            cleanup_orphan_processes
            log_success "清理完成"
            ;;
        clean-restart)
            clean_restart
            ;;
        codegen)
            codegen "$service"
            ;;
        migrate)
            migrate
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
