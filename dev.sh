#!/bin/bash

# dev.sh - 项目服务管理脚本
# 管理三个项目的启动、停止、状态查看和日志

set -e

# 项目路径配置
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/kg-edu-vite-antd"
BACKEND_DIR="$PROJECT_ROOT/backend/kg_edu"
AGENT_DIR="$PROJECT_ROOT/ai-agent/KgAgent"

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

# 等待服务启动
wait_for_service() {
    local service=$1
    local max_wait=${2:-30}
    local count=0
    while [ $count -lt $max_wait ]; do
        if is_running $service; then
            return 0
        fi
        sleep 1
        ((count++))
    done
    return 1
}

# 启动前端服务
start_frontend() {
    log_info "启动前端服务..."
    if is_running $FRONTEND; then
        log_warn "前端服务已在运行中 (PID: $(get_pid $FRONTEND))"
        return 0
    fi
    
    init_dirs
    cd "$FRONTEND_DIR"
    
    # 使用 nohup 后台运行
    nohup bun run dev:all > "$LOG_DIR/$FRONTEND.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/$FRONTEND.pid"
    
    sleep 2
    if is_running $FRONTEND; then
        log_success "前端服务已启动 (PID: $pid)"
        log_info "  - Vite Dev Server: http://localhost:8081"
        log_info "  - API Server: http://localhost:3000"
    else
        log_error "前端服务启动失败，请查看日志: $LOG_DIR/$FRONTEND.log"
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
    
    # 先执行数据库迁移
    log_info "执行数据库迁移..."
    mix ash.migrate >> "$LOG_DIR/$BACKEND.log" 2>&1 || true
    mix ash.migrate --tenants >> "$LOG_DIR/$BACKEND.log" 2>&1 || true
    
    # 启动 Phoenix 服务器
    nohup mix phx.server >> "$LOG_DIR/$BACKEND.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/$BACKEND.pid"
    
    sleep 3
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
    log_info "启动 AI Agent 服务..."
    if is_running $AGENT; then
        log_warn "AI Agent 服务已在运行中 (PID: $(get_pid $AGENT))"
        return 0
    fi
    
    init_dirs
    cd "$AGENT_DIR"
    
    nohup dotnet run --project KgAgent.csproj >> "$LOG_DIR/$AGENT.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/$AGENT.pid"
    
    sleep 3
    if is_running $AGENT; then
        log_success "AI Agent 服务已启动 (PID: $pid)"
        log_info "  - Agent Server: http://localhost:5000 或 http://localhost:5001"
    else
        log_error "AI Agent 服务启动失败，请查看日志: $LOG_DIR/$AGENT.log"
        return 1
    fi
}

# 停止服务
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
        kill "$pid" 2>/dev/null || true
        
        # 等待进程结束
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
            sleep 1
            ((count++))
        done
        
        # 如果进程还在运行，强制结束
        if kill -0 "$pid" 2>/dev/null; then
            log_warn "强制结束 $service_name 服务..."
            kill -9 "$pid" 2>/dev/null || true
        fi
        
        rm -f "$PID_DIR/$service.pid"
        log_success "$service_name 服务已停止"
    else
        log_warn "$service_name 服务未运行"
        rm -f "$PID_DIR/$service.pid"
    fi
}

# 停止前端服务
stop_frontend() {
    stop_service $FRONTEND "前端"
}

# 停止后端服务
stop_backend() {
    stop_service $BACKEND "后端"
}

# 停止 AI Agent 服务
stop_agent() {
    stop_service $AGENT "AI Agent"
}

# 停止所有服务
stop_all() {
    log_info "停止所有服务..."
    stop_frontend
    stop_backend
    stop_agent
    log_success "所有服务已停止"
}

# 启动所有服务
start_all() {
    log_info "启动所有服务..."
    start_backend
    start_agent
    start_frontend
    log_success "所有服务已启动"
}

# 查看服务状态
status_service() {
    local service=$1
    local service_name=$2
    local pid=$(get_pid $service)
    
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        echo -e "$service_name: ${GREEN}运行中${NC} (PID: $pid)"
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
    status_service $FRONTEND "前端 (Frontend)"
    status_service $BACKEND "后端 (Backend)"
    status_service $AGENT "AI Agent"
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

# 清理并构建前端
build() {
    log_info "清理前端构建缓存和端口..."
    cd "$FRONTEND_DIR"
    rm -rf node_modules/.vite node_modules/.cache dist .turbo 2>/dev/null || true
    lsof -i :8081 -i :3000 2>/dev/null | grep -v "^COMMAND" | awk '{print $2}' | sort -u | xargs -r kill -9 2>/dev/null || true
    pkill -f "esbuild" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    log_info "执行前端构建..."
    if [ -f "$PROJECT_ROOT/build-test.sh" ]; then
        bash "$PROJECT_ROOT/build-test.sh"
    else
        npm run build
    fi
    log_success "前端构建完成"
}

# 查看帮助
show_help() {
    echo "用法: $0 <command> [service] [options]"
    echo ""
    echo "命令:"
    echo "  start [service]    启动服务 (不指定则启动所有)"
    echo "  stop [service]     停止服务 (不指定则停止所有)"
    echo "  restart [service]  重启服务 (不指定则重启所有)"
    echo "  status             查看所有服务状态"
    echo "  logs <service>     查看服务日志"
    echo "  codegen <task>     生成 Ash API 代码 (后端专用)"
    echo "  migrate            执行数据库迁移 (后端专用)"
    echo "  build              清理缓存并构建前端"
    echo ""
    echo "服务名称:"
    echo "  frontend  - 前端服务 (Vite + API Server)"
    echo "  backend   - 后端服务 (Phoenix)"
    echo "  agent     - AI Agent 服务 (.NET)"
    echo "  all       - 所有服务"
    echo ""
    echo "示例:"
    echo "  $0 start           # 启动所有服务"
    echo "  $0 start frontend  # 只启动前端服务"
    echo "  $0 stop all        # 停止所有服务"
    echo "  $0 logs backend    # 查看后端日志"
    echo "  $0 codegen user    # 生成 user 相关的 Ash API"
    echo "  $0 migrate         # 执行数据库迁移"
    echo "  $0 build           # 清理并构建前端"
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
                all) stop_all; start_all ;;
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
        codegen)
            codegen "$service"
            ;;
        migrate)
            migrate
            ;;
        build)
            build
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
