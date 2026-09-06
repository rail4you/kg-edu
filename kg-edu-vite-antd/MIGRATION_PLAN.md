# Ant Design 迁移计划

## 当前状态

- **进度**: 阶段四 (页面迁移中)
- **端口**: 8081+
- **命令**: `npm run dev`

## 项目信息

| 项目     | 值                                            |
| -------- | --------------------------------------------- |
| 位置     | `/Users/bai/projects/kg-edu/kg-edu-vite-antd` |
| 原项目   | `/Users/bai/projects/kg-edu/minimal-vite-ts`  |
| 构建工具 | Vite                                          |
| UI 框架  | Ant Design 5                                  |

## 迁移进度

### ✅ 已完成

- [x] 阶段一：基础设施 (Vite + 依赖 + 核心文件)
- [x] 阶段二：基础组件 (main.tsx + App.tsx)
- [x] 阶段三：布局组件 (TeacherLayout + StudentLayout + AdminLayout)
- [x] 登录页面 (带组织选择 + 多租户支持)
- [x] AuthContext (用户状态管理 + token存储)
- [x] Logout 功能 (所有布局带用户头像下拉菜单)

### ✅ Teacher 页面 (按Section组织)

**课程管理**

- [x] 课程管理 (course.tsx) - 卡片式课程管理
- [x] 学生管理 (student-enrollment.tsx) - 学生选课管理

**知识点管理**

- [x] 知识点管理 (knowledge-resource.tsx) - 树形知识点
- [x] 知识关系 (knowledge-relation.tsx) - 知识点关系管理

**教学资源**

- [x] 习题管理 (exercise.tsx) - 习题CRUD
- [x] 试卷管理 (exam-management.tsx) - 考试管理

### 🔄 待完成

- [ ] Student 实际页面
- [ ] Admin 实际页面
- [ ] 高级功能 (Excel导入、AI生成等)

## 文件结构

```
src/
├── App.tsx
├── main.tsx
├── auth/
│   └── auth-context.tsx
├── layouts/
│   ├── teacher-layout.tsx
│   ├── student-layout.tsx
│   └── admin-layout.tsx
├── pages/
│   ├── login.tsx
│   ├── teacher/
│   │   ├── dashboard.tsx
│   │   ├── knowledge-resource.tsx
│   │   ├── knowledge-relation.tsx
│   │   ├── course.tsx
│   │   ├── student-enrollment.tsx
│   │   ├── exercise.tsx
│   │   └── exam-management.tsx
│   ├── student/
│   │   └── dashboard.tsx
│   └── admin/
│       └── dashboard.tsx
└── lib/
    ├── ash_rpc.ts
    ├── auth.ts
    └── tenant.ts
```

## 菜单结构 (Section)

```
教师工作台
├── 课程管理
│   ├── 课程管理
│   └── 学生管理
├── 知识点管理
│   ├── 知识点管理
│   └── 知识关系
└── 教学资源
    ├── 习题管理
    └── 试卷管理
```

## 路由结构

```
/login                                 → 登录页
/teacher/dashboard                     → 教师首页
/teacher/dashboard/course              → 课程管理
/teacher/dashboard/student-enrollment  → 学生管理
/teacher/dashboard/knowledge-resource  → 知识点管理
/teacher/dashboard/knowledge-relation  → 知识关系
/teacher/dashboard/exercise            → 习题管理
/teacher/dashboard/exam-management     → 试卷管理
/dashboard                             → 学生首页
/admin/dashboard                       → 管理员首页
```
