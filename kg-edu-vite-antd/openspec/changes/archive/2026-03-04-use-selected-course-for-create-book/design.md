## Context

教材管理页面 (`/teacher/dashboard/book-info`) 当前有两个课程选择器：
1. 页面顶部的课程筛选器 - 用于筛选显示指定课程的教材
2. 创建教材弹窗中的课程选择器 - 用于选择教材所属课程

当前流程：
1. 用户在页面顶部选择课程
2. 点击"添加教材"按钮
3. 弹窗中的课程字段为空，需要重新选择

用户期望：选择课程后创建教材时，应该自动使用已选择的课程。

## Goals / Non-Goals

**Goals:**
- 创建教材时自动填充已选择的课程
- 保持课程选择器可编辑，用户可修改

**Non-Goals:**
- 不修改编辑教材的逻辑（已支持课程编辑）
- 不修改课程筛选逻辑
- 不涉及后端API变更

## Decisions

**方案：在打开创建弹窗时预填充已选课程**

修改 `handleCreateBook` 或创建教材按钮的点击处理：

```tsx
const handleOpenCreateModal = () => {
  resetForm();
  // 如果已选择课程，预填充到表单
  if (selectedCourseId) {
    setFormData(prev => ({ ...prev, courseId: selectedCourseId }));
  }
  setCreateModalOpen(true);
};
```

**备选方案：** 使用 `useEffect` 监听弹窗打开状态，在打开时设置课程

考虑到简单性和可维护性，选择第一种方案，在打开弹窗时直接设置。

## Risks / Trade-offs

**风险：** 无明显风险
- 纯前端修改，不影响后端
- 已有课程筛选逻辑可复用
- 用户仍可手动修改课程

**权衡：**
- 编辑教材时是否也需要预填充？当前编辑教材时，已有课程的书籍会显示已选择的课程，这个行为保持不变。
