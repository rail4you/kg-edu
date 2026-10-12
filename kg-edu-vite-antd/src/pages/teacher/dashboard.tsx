import type { CSSProperties } from "react";
import {
  ReadOutlined,
  TeamOutlined,
  BookOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { Button, Empty, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import "./dashboard.css";

/* ────────────────────── types ────────────────────── */

interface WeekActivityDay {
  date: string;
  label: string;
  count: number;
}

interface TodoItem {
  key: string;
  title: string;
  desc: string;
  count: number;
  path: string;
}

interface DashboardStats {
  studentCount: number;
  knowledgeCount: number;
  homeworkCount: number;
  weekActivity?: WeekActivityDay[];
  weekActivityTotal?: number;
  todos?: TodoItem[];
  calculatedAt: string;
}

/* ────────────────────── static content（参照原型教师工作台） ────────────────────── */

const COVER_THEMES = ["", " alt", " third"];

/* ────────────────────── component ────────────────────── */

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();

  const { courses } = useCourses({
    fields: ["id", "title", "description", "major", "semester"],
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboardStats", tenant],
    queryFn: async () => {
      const result = await getDashboardStats({
        tenant: tenant || "",
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success) return result.data as DashboardStats;
      return null;
    },
    enabled: !!tenant && !!user,
  });

  const weekActivity = statsData?.weekActivity ?? [];
  const weekTotal = statsData?.weekActivityTotal ?? 0;
  const weekMax = Math.max(1, ...weekActivity.map((day) => day.count));
  const hasWeekData = weekActivity.length > 0 && weekTotal > 0;
  const todos = statsData?.todos ?? [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好";
  const name = user?.displayName || "王老师";

  const statCards = [
    { label: "授课课程", value: courses.length, desc: "本学期正在运行", icon: <ReadOutlined /> },
    {
      label: "在课学生",
      value: statsData?.studentCount ?? 0,
      desc: "分布于 6 个教学班",
      icon: <TeamOutlined />,
    },
    {
      label: "课程知识点",
      value: statsData?.knowledgeCount ?? 0,
      desc: "构建结构化知识体系",
      icon: <BookOutlined />,
    },
    {
      label: "待批阅作业",
      value: statsData?.homeworkCount ?? 0,
      desc: "来自 2 门课程",
      icon: <FileTextOutlined />,
    },
  ];

  return (
    <div className="teacher-dashboard">
      <div className="pu-breadcrumb">智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;教师工作台</div>
      <div className="page-head">
        <div>
          <h1>
            {name}，{greeting}
          </h1>
          <p>今天也有新的想法，值得带进课堂。</p>
        </div>
        <div className="row">
          <Button onClick={() => message.info("当前展示 2026 秋季学期演示数据")}>
            2026 秋季学期
          </Button>
        </div>
      </div>

      <div className="grid stats">
        {statCards.map((card) => (
          <div className="card stat" key={card.label}>
            <span className="stat-icon">{card.icon}</span>
            <small>{card.label}</small>
            <div className="number">{card.value}</div>
            <small>{card.desc}</small>
          </div>
        ))}
      </div>

      <div className="grid two">
        <section className="card">
          <div className="card-title">
            <h2>本周学习活跃情况</h2>
            <span className="tag blue">最近 7 天</span>
          </div>
          <div className="row">
            <b style={{ fontSize: 26, lineHeight: 1.4 }}>{weekTotal}</b>
            <small style={{ color: "var(--td-muted)" }}>学习活动次数</small>
          </div>
          {statsLoading ? (
            <div className="legend">加载中…</div>
          ) : hasWeekData ? (
            <>
              <div className="chart" role="img" aria-label="最近七天学习活动趋势">
                {weekActivity.map((day) => (
                  <div
                    key={day.date}
                    className="bar"
                    style={{ "--h": `${Math.round((day.count / weekMax) * 100)}%` } as CSSProperties}
                    title={`${day.label}：${day.count} 次`}
                  >
                    <span>{day.label}</span>
                  </div>
                ))}
              </div>
              <div className="legend">柱高代表每日活动次数 · 近 7 天真实数据</div>
            </>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="本周暂无学习活动记录"
              style={{ margin: "12px 0" }}
            />
          )}
        </section>

        <section className="card">
          <div className="card-title">
            <h2>待办事项</h2>
            <a onClick={() => navigate("/teacher/dashboard/homework")}>查看全部 →</a>
          </div>
          {statsLoading ? (
            <div className="legend">加载中…</div>
          ) : todos.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无待办事项"
              style={{ margin: "12px 0" }}
            />
          ) : (
            todos.map((item, i) => (
              <div className="item" key={item.key}>
                <span className="item-number">{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
                <Button onClick={() => navigate(item.path)}>处理</Button>
              </div>
            ))
          )}
        </section>
      </div>

      <div className="catalog-title">
        <h2>我的课程</h2>
        <a onClick={() => navigate("/teacher/dashboard/course")}>查看全部 →</a>
      </div>

      {courses.length === 0 ? (
        <div className="card">
          <Empty description="暂无课程" />
        </div>
      ) : (
        <div className="grid three">
          {courses.slice(0, 3).map((course, i) => {
            const subtitle = [course.major, course.semester].filter(Boolean).join(" · ");
            return (
              <article className="card course-card" key={course.id}>
                <div className={`course-cover${COVER_THEMES[i % 3]}`}>
                  <small>COURSE {String(i + 1).padStart(2, "0")}</small>
                  <b>{course.title}</b>
                  <span>{subtitle || "DESIGN FOUNDATIONS"}</span>
                </div>
                <h3>{course.title}</h3>
                <p>{course.major || "智慧课程"}</p>
                <p className="course-card-desc">
                  {course.description || "查看课程内容与教学安排。"}
                </p>
                <div className="row">
                  <span className="tag blue">已发布</span>
                  <Button
                    onClick={() => navigate(`/teacher/dashboard/course-info?courseId=${course.id}`)}
                  >
                    管理课程 →
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
