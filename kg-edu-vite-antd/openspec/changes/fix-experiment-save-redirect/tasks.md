## 1. 修改实验表单页面重定向逻辑

- [x] 1.1 修改 `experiment-form.tsx` 中 createMutation 的成功回调，跳转时添加 `?courseId=${formData.courseId}` 参数
- [x] 1.2 修改 `experiment-form.tsx` 中 updateMutation 的成功回调，跳转时添加 `?courseId=${formData.courseId}` 参数
- [x] 1.3 验证 formData.courseId 在保存时确实有值

## 2. 修改实验管理页面支持 URL 参数

- [x] 2.1 在 `experiment-management.tsx` 中引入 `useSearchParams` hooks
- [x] 2.2 在组件初始化时从 URL search params 读取 `courseId`
- [x] 2.3 将读取的 courseId 设置到 selectedCourseId state 中初始化选中状态

## 3. 验证与测试

- [ ] 3.1 从课程页面添加实验，保存后验证跳转正确
- [ ] 3.2 编辑已有实验，保存后验证跳转正确
- [ ] 3.3 验证 URL 参数为空时的默认行为
