import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import {
  getAllCourses,
  getUser,
  listCourses,
  listEnrollments,
  listOrganizations,
  type GetAllCoursesFields,
} from "@/lib/ash_rpc";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";

export interface CatalogOrganization {
  id: string;
  name: string;
  schemaName: string;
}

export interface StandardSubjectTemplate {
  code: string;
  name: string;
  description: string;
  aliases: string[];
}

export interface CatalogCourse {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  major?: string | null;
  semester?: string | null;
  semesterHours?: number | null;
  teacherId?: string | null;
  teacherName?: string;
  teacherAvatar?: string | null;
  orgName: string;
  orgSchemaName: string;
  browseCount?: number | null;
  /** 选课学生人数（学习人数），来自 course_enrollments 统计 */
  enrolledCount?: number;
  publishStatus?: boolean | null;
  educationLevel?: string | null;
  subjectCategory?: {
    id?: string;
    name?: string | null;
    description?: string | null;
    code?: string | null;
  } | null;
  standardSubject: StandardSubjectTemplate;
  originalSubjectName: string;
  catalogIndex: number;
  isEnrolled: boolean;
}

export interface SubjectStat extends StandardSubjectTemplate {
  count: number;
  mappedLabels: string[];
}

interface TeacherSummary {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
}

interface RawCatalogCourse {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  major?: string | null;
  semester?: string | null;
  semesterHours?: number | null;
  teacherId?: string | null;
  browseCount?: number | null;
  publishStatus?: boolean | null;
  educationLevel?: string | null;
  subjectCategory?: {
    id?: string;
    name?: string | null;
    description?: string | null;
    code?: string | null;
  } | null;
}

const COURSE_FIELDS = [
  "id",
  "title",
  "description",
  "imageUrl",
  "major",
  "semester",
  "semesterHours",
  "teacherId",
  "browseCount",
  "publishStatus",
  "educationLevel",
  { subjectCategory: ["id", "name", "description", "code"] },
] as const satisfies GetAllCoursesFields;

export const STANDARD_SUBJECT_TEMPLATES: StandardSubjectTemplate[] = [
  {
    code: "philosophy",
    name: "哲学",
    description: "哲学、逻辑学、伦理学、马克思主义理论等方向",
    aliases: ["哲学", "逻辑学", "伦理学", "马克思主义", "思想政治"],
  },
  {
    code: "economics",
    name: "经济学",
    description: "经济学、金融学、国际经济与贸易等方向",
    aliases: ["经济学", "金融", "国际经济", "贸易", "财政", "统计经济"],
  },
  {
    code: "law",
    name: "法学",
    description: "法学、社会学、政治学、民族学等方向",
    aliases: ["法学", "政治学", "社会学", "民族学", "公安学"],
  },
  {
    code: "military",
    name: "军事学",
    description: "军事理论、国防教育、军事训练等方向",
    aliases: ["军事学", "国防", "军事理论", "军训"],
  },
  {
    code: "education",
    name: "教育学",
    description: "教育学、学前教育、特殊教育、教育技术等方向",
    aliases: ["教育学", "教育技术", "学前教育", "特殊教育", "教育管理"],
  },
  {
    code: "literature",
    name: "文学",
    description: "中国语言文学、外国语言文学、翻译等方向",
    aliases: ["文学", "汉语言", "中文", "外语", "翻译", "新闻写作"],
  },
  {
    code: "history",
    name: "历史学",
    description: "历史学、世界史、考古学等方向",
    aliases: ["历史学", "世界史", "考古", "文博"],
  },
  {
    code: "science",
    name: "理学",
    description: "数学、物理、化学、地理、生物等基础科学方向",
    aliases: ["理学", "数学", "物理", "化学", "生物", "地理", "天文", "海洋", "统计学"],
  },
  {
    code: "engineering",
    name: "工学",
    description: "计算机、人工智能、软件、电子、自动化、机械等工程方向",
    aliases: ["工学", "人工智能", "计算机", "软件", "电子", "自动化", "机械", "通信", "网络工程"],
  },
  {
    code: "agriculture",
    name: "农学",
    description: "农学、园艺、植物保护、林学、水产等方向",
    aliases: ["农学", "园艺", "植物保护", "林学", "草业", "水产", "动物科学", "动物医学"],
  },
  {
    code: "medicine",
    name: "医学",
    description: "基础医学、临床医学、护理、口腔、药学等方向",
    aliases: ["医学", "临床", "护理", "口腔", "药学", "中医", "公共卫生"],
  },
  {
    code: "management",
    name: "管理学",
    description: "工商管理、公共管理、信息管理、物流管理等方向",
    aliases: ["管理学", "工商管理", "公共管理", "信息管理", "物流", "会计", "审计", "养老服务"],
  },
  {
    code: "arts",
    name: "艺术学",
    description: "设计、美术、音乐、戏剧影视、数字媒体等方向",
    aliases: ["艺术学", "设计", "美术", "音乐", "戏剧", "影视", "动画", "数字媒体"],
  },
  {
    code: "interdisciplinary",
    name: "交叉学科",
    description: "多学科融合的新兴方向，如智能科学、数字人文等",
    aliases: ["交叉学科", "智能科学", "数字人文", "跨学科"],
  },
  {
    code: "public-undergraduate",
    name: "公共基础课（本科）",
    description: "大学英语、大学物理、思政、体育、计算机基础等本科公共课程",
    aliases: ["公共基础课（本科）", "大学英语", "大学物理", "高等数学", "思政", "体育"],
  },
  {
    code: "public-vocational",
    name: "公共基础课（高职）",
    description: "高职院校通识、职业素养、公共基础类课程",
    aliases: ["公共基础课（高职）", "职业素养", "高职数学", "高职英语"],
  },
  {
    code: "transportation",
    name: "交通运输大类",
    description: "交通工程、轨道、航运、物流运输等方向",
    aliases: ["交通运输大类", "交通运输", "轨道交通", "航运", "港口"],
  },
  {
    code: "public-service",
    name: "公共管理与服务大类",
    description: "公共服务、社区管理、智慧政务等方向",
    aliases: ["公共管理与服务大类", "公共服务", "社区管理", "智慧政务"],
  },
  {
    code: "justice",
    name: "公安与司法大类",
    description: "司法、安防、法律事务、治安管理等方向",
    aliases: ["公安与司法大类", "司法", "法律事务", "安防"],
  },
  {
    code: "agri-vocational",
    name: "农林牧渔大类",
    description: "涉农高职专业方向",
    aliases: ["农林牧渔大类", "农林牧渔", "畜牧", "渔业"],
  },
  {
    code: "medical-vocational",
    name: "医药卫生大类",
    description: "医药、护理、康复、卫生服务等高职方向",
    aliases: ["医药卫生大类", "康复", "卫生服务", "药品"],
  },
  {
    code: "civil-construction",
    name: "土木建筑大类",
    description: "土木、建筑、工程造价、城乡规划等方向",
    aliases: ["土木建筑大类", "土木", "建筑", "工程造价", "城乡规划"],
  },
  {
    code: "culture-arts",
    name: "文化艺术大类",
    description: "文化创意、表演艺术、视觉传播等高职方向",
    aliases: ["文化艺术大类", "文化创意", "表演艺术", "视觉传播"],
  },
  {
    code: "journalism",
    name: "新闻传播大类",
    description: "新闻、传播、网络与新媒体、播音主持等方向",
    aliases: ["新闻传播大类", "新闻传播", "网络与新媒体", "播音主持"],
  },
  {
    code: "tourism",
    name: "旅游大类",
    description: "旅游管理、酒店管理、会展等方向",
    aliases: ["旅游大类", "旅游管理", "酒店管理", "会展"],
  },
  {
    code: "water-conservancy",
    name: "水利大类",
    description: "水利工程、水文、港航等方向",
    aliases: ["水利大类", "水利工程", "水文", "港航"],
  },
  {
    code: "bio-chemical",
    name: "生物与化工大类",
    description: "生物技术、化工、制药工程等方向",
    aliases: ["生物与化工大类", "生物技术", "化工", "制药工程"],
  },
  {
    code: "electronics-info",
    name: "电子与信息大类",
    description: "电子信息、物联网、云计算、大数据等高职方向",
    aliases: ["电子与信息大类", "电子信息", "物联网", "云计算", "大数据"],
  },
  {
    code: "energy-materials",
    name: "能源动力与材料大类",
    description: "能源、动力、材料、储能等方向",
    aliases: ["能源动力与材料大类", "能源", "动力", "材料", "储能"],
  },
  {
    code: "equipment",
    name: "装备制造大类",
    description: "机械制造、机电一体化、智能制造、数控等方向",
    aliases: ["装备制造大类", "智能制造", "机电一体化", "数控", "制造"],
  },
  {
    code: "business",
    name: "财经商贸大类",
    description: "财务、税务、市场营销、电子商务、国际商务等方向",
    aliases: ["财经商贸大类", "市场营销", "电子商务", "国际商务", "财务", "税务"],
  },
  {
    code: "environment-safety",
    name: "资源环境与安全大类",
    description: "环境保护、安全工程、资源勘查等方向",
    aliases: ["资源环境与安全大类", "安全工程", "环境保护", "资源勘查"],
  },
  {
    code: "textile",
    name: "轻工纺织大类",
    description: "纺织、服装、皮革、产品设计等方向",
    aliases: ["轻工纺织大类", "纺织", "服装", "皮革"],
  },
  {
    code: "food-medicine",
    name: "食品药品与粮食大类",
    description: "食品科学、药品生产、粮食工程等方向",
    aliases: ["食品药品与粮食大类", "食品科学", "粮食工程", "药品生产"],
  },
  {
    code: "sports-education",
    name: "教育与体育大类",
    description: "体育教育、运动训练、职业教育服务等方向",
    aliases: ["教育与体育大类", "体育教育", "运动训练", "体育"],
  },
];

const SUBJECT_TEMPLATE_BY_CODE = new Map(
  STANDARD_SUBJECT_TEMPLATES.map((subject) => [subject.code, subject]),
);

function normalizeText(value?: string | null) {
  return (value || "").replace(/[（(]/g, "(").replace(/[）)]/g, ")").trim().toLowerCase();
}

function scoreTemplate(subject: StandardSubjectTemplate, text: string) {
  const normalizedName = normalizeText(subject.name);

  if (text === normalizedName) {
    return 100;
  }

  if (text.includes(normalizedName)) {
    return 80;
  }

  return subject.aliases.reduce((score, alias) => {
    const normalizedAlias = normalizeText(alias);

    if (!normalizedAlias) {
      return score;
    }

    if (text === normalizedAlias) {
      return Math.max(score, 96);
    }

    if (text.includes(normalizedAlias)) {
      return Math.max(score, Math.min(92, normalizedAlias.length + 60));
    }

    return score;
  }, 0);
}

function resolveStandardSubject(course: {
  subjectCategory?: { name?: string | null; description?: string | null } | null;
  major?: string | null;
  title?: string | null;
  description?: string | null;
}) {
  const rawSubject = course.subjectCategory?.name?.trim() || "";
  const sourceText = normalizeText(
    [rawSubject, course.major, course.title, course.description, course.subjectCategory?.description]
      .filter(Boolean)
      .join(" | "),
  );

  let bestMatch = SUBJECT_TEMPLATE_BY_CODE.get("interdisciplinary")!;
  let bestScore = 0;

  for (const template of STANDARD_SUBJECT_TEMPLATES) {
    const score = scoreTemplate(template, sourceText);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  return bestMatch;
}

async function fetchTeacherMap(
  org: CatalogOrganization,
  courses: RawCatalogCourse[],
  headers?: Record<string, string>,
) {
  const teacherIds = Array.from(
    new Set(
      courses
        .map((course) => course.teacherId)
        .filter((teacherId): teacherId is string => typeof teacherId === "string" && teacherId.length > 0),
    ),
  );

  if (!teacherIds.length) {
    return {} as Record<string, TeacherSummary>;
  }

  const teacherEntries = await Promise.all(
    teacherIds.map(async (teacherId) => {
      try {
        const result = await getUser({
          tenant: org.schemaName,
          input: { id: teacherId },
          fields: ["id", "name", "avatarUrl"],
          headers,
        });

        if (!result.success || !result.data) {
          return null;
        }

        const teacher = Array.isArray(result.data) ? result.data[0] : result.data;
        if (!teacher?.id) {
          return null;
        }

        return [teacher.id, teacher] as const;
      } catch (error) {
        console.error(`Failed to fetch teacher ${teacherId} for tenant ${org.schemaName}`, error);
        return null;
      }
    }),
  );

  return Object.fromEntries(
    teacherEntries.filter(Boolean) as Array<readonly [string, TeacherSummary]>,
  );
}

async function fetchEnrollmentCounts(
  org: CatalogOrganization,
  headers?: Record<string, string>,
) {
  try {
    const result = await listEnrollments({
      tenant: org.schemaName,
      fields: ["courseId"],
      page: { limit: 1000, offset: 0 },
      headers,
    });

    const enrollments = extractArrayData(result) as Array<{ courseId?: string }>;
    const counts = new Map<string, number>();
    for (const enrollment of enrollments) {
      if (!enrollment?.courseId) {
        continue;
      }
      counts.set(enrollment.courseId, (counts.get(enrollment.courseId) || 0) + 1);
    }
    return counts;
  } catch (error) {
    console.error(`Failed to fetch enrollment counts for tenant ${org.schemaName}`, error);
    return new Map<string, number>();
  }
}

async function fetchEnrolledCourseIds(
  org: CatalogOrganization,
  headers: Record<string, string>,
  enabled: boolean,
) {
  if (!enabled) {
    return new Set<string>();
  }

  try {
    const result = await listCourses({
      tenant: org.schemaName,
      fields: ["id"],
      page: { limit: 500, offset: 0 },
      headers,
    });

    const enrolledCourses = extractArrayData(result) as Array<{ id: string }>;
    return new Set(enrolledCourses.map((course) => course.id));
  } catch (error) {
    console.error(`Failed to fetch enrolled courses for tenant ${org.schemaName}`, error);
    return new Set<string>();
  }
}

async function fetchCatalog(
  headers?: Record<string, string>,
  options?: { shouldLoadEnrollment?: boolean },
) {
  const organizationsResult = await listOrganizations({
    fields: ["id", "name", "schemaName"],
    sort: "+name",
    headers,
  });

  const organizations = extractArrayData(organizationsResult).filter(
    (org): org is CatalogOrganization => typeof org?.schemaName === "string" && org.schemaName.length > 0,
  );

  let catalogIndex = 0;

  const coursesByOrg = await Promise.all(
    organizations.map(async (org) => {
      try {
        const enrolledCourseIds = await fetchEnrolledCourseIds(
          org,
          headers || { "Content-Type": "application/json" },
          Boolean(headers && options?.shouldLoadEnrollment),
        );
        const enrollmentCounts = await fetchEnrollmentCounts(org, headers);

        const coursesResult = await getAllCourses({
          tenant: org.schemaName,
          fields: COURSE_FIELDS,
          headers,
        });

        const courses = extractArrayData(coursesResult) as RawCatalogCourse[];
        const teacherMap = await fetchTeacherMap(org, courses, headers);

        return courses
          .filter((course) => course?.id && course?.title && course.publishStatus !== false)
          .map((course) => {
            const standardSubject = resolveStandardSubject(course);
            const originalSubjectName = course.subjectCategory?.name?.trim() || standardSubject.name;
            const teacher = course.teacherId ? teacherMap[course.teacherId] : null;

            catalogIndex += 1;

            return {
              ...course,
              orgName: org.name,
              orgSchemaName: org.schemaName,
              teacherName: teacher?.name || "教师待完善",
              teacherAvatar: teacher?.avatarUrl || null,
              standardSubject,
              originalSubjectName,
              catalogIndex,
              isEnrolled: enrolledCourseIds.has(course.id),
              enrolledCount: enrollmentCounts.get(course.id) || 0,
            } as CatalogCourse;
          });
      } catch (error) {
        console.error(`Failed to fetch catalog for tenant ${org.schemaName}`, error);
        return [] as CatalogCourse[];
      }
    }),
  );

  return {
    organizations,
    courses: coursesByOrg.flat(),
  };
}

export function buildSubjectStats(courses: CatalogCourse[], level?: string) {
  const statsMap = new Map<string, SubjectStat>(
    STANDARD_SUBJECT_TEMPLATES.map((subject) => [
      subject.code,
      {
        ...subject,
        count: 0,
        mappedLabels: [],
      },
    ]),
  );

  for (const course of courses) {
    if (level && course.educationLevel !== level) {
      continue;
    }

    const entry = statsMap.get(course.standardSubject.code);
    if (!entry) {
      continue;
    }

    entry.count += 1;

    if (
      course.originalSubjectName &&
      course.originalSubjectName !== entry.name &&
      !entry.mappedLabels.includes(course.originalSubjectName)
    ) {
      entry.mappedLabels.push(course.originalSubjectName);
    }
  }

  return STANDARD_SUBJECT_TEMPLATES.map((subject) => statsMap.get(subject.code)!);
}

export function useCourseCatalog() {
  const { user } = useAuth();
  const headers = user ? getHeaders(user) : undefined;
  const shouldLoadEnrollment = user?.role === "user" || user?.role === "student";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["course-portal-catalog", user?.id || "guest", shouldLoadEnrollment],
    queryFn: () => fetchCatalog(headers, { shouldLoadEnrollment }),
    staleTime: 5 * 60 * 1000,
  });

  const organizations = useMemo(() => data?.organizations ?? [], [data?.organizations]);
  const courses = useMemo(() => data?.courses ?? [], [data?.courses]);

  const recommendedCourses = useMemo(
    () =>
      [...courses].sort((left, right) => {
        const browseGap = (right.browseCount || 0) - (left.browseCount || 0);
        if (browseGap !== 0) {
          return browseGap;
        }

        return left.catalogIndex - right.catalogIndex;
      }),
    [courses],
  );

  const newestCourses = useMemo(
    () =>
      [...courses].sort((left, right) => {
        const indexGap = right.catalogIndex - left.catalogIndex;
        if (indexGap !== 0) {
          return indexGap;
        }

        return (right.browseCount || 0) - (left.browseCount || 0);
      }),
    [courses],
  );

  const subjectStats = useMemo(() => buildSubjectStats(courses), [courses]);

  return {
    organizations,
    courses,
    recommendedCourses,
    newestCourses,
    subjectStats,
    isLoading,
    error,
    refetch,
  };
}
