## Context

当前学生选课功能存在问题：已登录学生查看未选课程时，页面缺少"选课"按钮，无法完成选课操作。

现有代码逻辑 (front.tsx lines 569-605):
- 已登录 + 已选课 → 显示"进入课程学习"按钮
- 未登录 → 显示"浏览更多课程"按钮  
- 已登录 + 未选课 → 无按钮显示 (BUG)

## Goals / Non-Goals

**Goals:**
- 在课程详情页为已登录但未选课的学生显示"立即选课"按钮
- 集成 enrollStudent API 实现选课功能
- 选课成功后自动跳转课程学习页面

**Non-Goals:**
- 不修改教师端学生管理页面
- 不添加选课限制逻辑(名额、时间等)
- 不修改后端选课API

## Decisions

1. **使用现有 enrollStudent API** - 不需要创建新接口，直接使用已存在的 `enrollStudent` 函数 from `@/lib/ash_rpc`

2. **使用 useMutation 管理选课状态** - 复用 React Query 的 useMutation 处理加载状态、成功率、错误处理

3. **选课成功后跳转** - 调用 `navigate("/dashboard/overview")` 进入学习页面，与已选课用户的逻辑一致

## Risks / Trade-offs

- [风险] 选课 API 失败无提示 → 需添加 error 处理和 message 提示
- [风险] 重复选课 → API 应已有幂等处理，页面可添加按钮 loading 状态防止重复点击
