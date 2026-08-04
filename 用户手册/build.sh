#!/usr/bin/env bash
# 用户手册构建脚本：将 Markdown 转换为 PDF / DOCX
# 用法：./build.sh [student|teacher|admin|superadmin|all]

set -e

cd "$(dirname "$0")"

MANUALS=("学生端使用手册" "教师端使用手册" "管理端使用手册" "超级管理员使用手册")

build_pdf() {
    local name="$1"
    if [[ ! -f "${name}.md" ]]; then
        echo "⚠️  跳过：${name}.md 不存在"
        return
    fi
    echo "📄 生成 PDF: ${name}.pdf"
    pandoc "${name}.md" \
        -o "${name}.pdf" \
        --pdf-engine=xelatex \
        -V "mainfont=PingFang SC" \
        -V "geometry:margin=2cm" \
        --toc --toc-depth=2 \
        --resource-path=images 2>&1 | head -5 || true
}

build_docx() {
    local name="$1"
    if [[ ! -f "${name}.md" ]]; then
        echo "⚠️  跳过：${name}.md 不存在"
        return
    fi
    echo "📝 生成 DOCX: ${name}.docx"
    pandoc "${name}.md" \
        -o "${name}.docx" \
        --toc --toc-depth=2 \
        --resource-path=images 2>&1 | head -3 || true
}

build_html() {
    local name="$1"
    if [[ ! -f "${name}.md" ]]; then
        return
    fi
    echo "🌐 生成 HTML: ${name}.html"
    pandoc "${name}.md" \
        -o "${name}.html" \
        --self-contained \
        --toc --toc-depth=2 \
        --resource-path=images \
        -c pandoc.css 2>&1 | head -3 || true
}

target="${1:-all}"

case "$target" in
    student|teacher|admin|superadmin)
        name="${role_map[$target]:-$target}"
        ;;
    all)
        for m in "${MANUALS[@]}"; do
            build_pdf "$m"
            build_docx "$m"
            build_html "$m"
        done
        ;;
    pdf)
        for m in "${MANUALS[@]}"; do build_pdf "$m"; done
        ;;
    docx)
        for m in "${MANUALS[@]}"; do build_docx "$m"; done
        ;;
    html)
        for m in "${MANUALS[@]}"; do build_html "$m"; done
        ;;
    *)
        echo "用法: $0 [all|pdf|docx|html|student|teacher|admin|superadmin]"
        exit 1
        ;;
esac

echo "✅ 完成"