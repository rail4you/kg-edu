## 1. 导入和配置

- [x] 1.1 导入 bulkEnrollStudents API from @/lib/ash_rpc
- [x] 1.2 导入 useMutation from @tanstack/react-query

## 2. 实现选课功能

- [x] 2.1 创建 enrollMutation 使用 useMutation
- [x] 2.2 配置 mutationFn 调用 bulkEnrollStudents API
- [x] 2.3 添加 onSuccess 回调处理选课成功
- [x] 2.4 添加 onError 回调处理选课失败

## 3. 添加选课按钮

- [x] 3.1 在 Hero 区域添加"立即选课"按钮 (user && !isEnrolled 条件)
- [x] 3.2 添加按钮点击事件调用 enrollMutation.mutate
- [x] 3.3 添加按钮 loading 状态 (enrollMutation.isPending)
- [x] 3.4 选课成功后自动跳转到 /dashboard/overview
