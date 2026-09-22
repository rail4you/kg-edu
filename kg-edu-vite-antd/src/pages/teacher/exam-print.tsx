import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Button,
  Typography,
  Spin,
  Empty,
  Form,
  Select,
  Switch,
  Input,
  Radio,
  Divider,
  Row,
  Col,
} from "antd";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useParams, useNavigate } from "react-router-dom";
import { getExamContent } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

const { Title, Text, Paragraph } = Typography;

type PageSize = "A3" | "A4" | "B4";

const PAGE_WIDTH: Record<PageSize, string> = {
  A3: "297mm",
  A4: "210mm",
  B4: "257mm",
};

const TYPE_NAME: Record<string, string> = {
  multiple_choice: "单选题",
  multiple_response: "多选题",
  true_false: "判断题",
  fill_in_blank: "填空题",
  essay: "问答题",
  term_definition: "名词解释",
  case_study: "案例题",
};

export default function ExamPrint() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { examId } = useParams();
  const currentTenant = getCurrentTenant();

  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [showSealLine, setShowSealLine] = useState(true);
  const [sealPosition, setSealPosition] = useState<"left" | "right">("left");
  const [showPledge, setShowPledge] = useState(true);
  const [pledgeText, setPledgeText] = useState(
    "本人郑重承诺：自觉遵守考试纪律，独立完成答卷，杜绝一切作弊行为。",
  );
  const [showCourseInfo, setShowCourseInfo] = useState(true);
  const [showStudentInfo, setShowStudentInfo] = useState(true);
  const [courseName, setCourseName] = useState("");
  const [examTitle, setExamTitle] = useState("");

  const { data: examData, isLoading } = useQuery({
    queryKey: ["exam-print", examId],
    queryFn: async () => {
      const result = await getExamContent({
        tenant: currentTenant?.schemaName || "",
        input: { id: examId! },
        fields: ["id", "title", "description", "durationMinutes", "passingScore",
          { examExercises: ["id", "order", "points", { exercise: ["id", "title", "questionContent", "questionType", "options"] }] }],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success && result.data) return result.data as any;
      return null;
    },
    enabled: !!examId && !!user,
  });

  React.useEffect(() => {
    if (examData?.title && !examTitle) setExamTitle(examData.title);
  }, [examData]);

  if (authLoading || isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!examData) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="试卷不存在" />
      </div>
    );
  }

  const exercises = [...(examData.examExercises || [])].sort(
    (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0),
  );
  const totalScore = exercises.reduce((s: number, e: any) => s + (e.points ?? 0), 0);

  const renderOptions = (ex: any) => {
    const opts = ex.exercise?.options;
    if (!opts) return null;
    let parsed: any = opts;
    if (typeof opts === "string") {
      try {
        parsed = JSON.parse(opts);
      } catch {
        return <Paragraph>{opts}</Paragraph>;
      }
    }
    const choices: string[] = parsed?.choices || Object.values(parsed || {});
    if (!choices.length) return null;
    return (
      <div style={{ marginTop: 4 }}>
        {choices.map((c: string, i: number) => (
          <div key={i} style={{ lineHeight: 1.9 }}>{c}</div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", paddingBottom: 24 }}>
      <style>{`
        @media print {
          .exam-print-config, .exam-print-header { display: none !important; }
          .exam-print-paper { box-shadow: none !important; margin: 0 !important; max-width: none !important; width: 100% !important; }
          @page { size: ${pageSize}; margin: 12mm; }
        }
      `}</style>

      <div className="exam-print-header" style={{ padding: 24, background: "white", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 8 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>试卷自定义导出</Title>
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          导出 / 打印
        </Button>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <Card className="exam-print-config" title="模板配置" style={{ marginBottom: 16 }}>
          <Form layout="inline" style={{ rowGap: 12 }}>
            <Form.Item label="版式">
              <Radio.Group value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                <Radio.Button value="A3">A3</Radio.Button>
                <Radio.Button value="A4">A4</Radio.Button>
                <Radio.Button value="B4">B4</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="密封线">
              <Switch checked={showSealLine} onChange={setShowSealLine} />
            </Form.Item>
            {showSealLine && (
              <Form.Item label="密封线位置">
                <Select value={sealPosition} onChange={setSealPosition} style={{ width: 100 }}>
                  <Select.Option value="left">左侧</Select.Option>
                  <Select.Option value="right">右侧</Select.Option>
                </Select>
              </Form.Item>
            )}
            <Form.Item label="考试承诺书">
              <Switch checked={showPledge} onChange={setShowPledge} />
            </Form.Item>
            <Form.Item label="课程信息">
              <Switch checked={showCourseInfo} onChange={setShowCourseInfo} />
            </Form.Item>
            <Form.Item label="学生信息">
              <Switch checked={showStudentInfo} onChange={setShowStudentInfo} />
            </Form.Item>
          </Form>
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col span={8}>
              <Input addonBefore="试卷标题" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} />
            </Col>
            <Col span={8}>
              <Input addonBefore="课程名称" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="如：高等数学" />
            </Col>
          </Row>
          {showPledge && (
            <Input.TextArea
              style={{ marginTop: 12 }}
              rows={2}
              value={pledgeText}
              onChange={(e) => setPledgeText(e.target.value)}
            />
          )}
        </Card>

        {/* —— 纸张预览（所见即所得，打印时即此效果） —— */}
        <div
          className="exam-print-paper"
          style={{
            background: "white",
            maxWidth: PAGE_WIDTH[pageSize],
            margin: "0 auto",
            padding: "12mm",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            display: "flex",
          }}
        >
          {showSealLine && sealPosition === "left" && (
            <div style={{ writingMode: "vertical-rl", borderRight: "1px dashed #333", paddingRight: 6, marginRight: 12, letterSpacing: 8, color: "#333" }}>
              装订线 · 密封线内不要答题
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <Title level={3} style={{ margin: 0 }}>{examTitle || examData.title}</Title>
              <div style={{ marginTop: 6, color: "#333" }}>
                {showCourseInfo && <span>课程：{courseName || "——"}　</span>}
                <span>满分：{totalScore} 分　</span>
                <span>时长：{examData.durationMinutes || 60} 分钟</span>
              </div>
              {showStudentInfo && (
                <div style={{ marginTop: 8, display: "flex", gap: 24, justifyContent: "center" }}>
                  <span>学院：________</span>
                  <span>班级：________</span>
                  <span>姓名：________</span>
                  <span>学号：________</span>
                </div>
              )}
            </div>

            {showPledge && (
              <div style={{ border: "1px solid #333", padding: 8, marginBottom: 12 }}>
                <Text strong>考试承诺书</Text>
                <Paragraph style={{ margin: "4px 0 8px" }}>{pledgeText}</Paragraph>
                <div style={{ textAlign: "right" }}>签名：________　　日期：________</div>
              </div>
            )}

            <Divider style={{ margin: "8px 0" }} />

            {exercises.map((ee: any, idx: number) => (
              <div key={ee.id} style={{ marginBottom: 14, breakInside: "avoid" }}>
                <div style={{ fontWeight: 600, lineHeight: 1.8 }}>
                  {idx + 1}．[{TYPE_NAME[ee.exercise?.questionType] || ee.exercise?.questionType}]{" "}
                  {ee.exercise?.title}（{ee.points} 分）
                </div>
                {ee.exercise?.questionContent && ee.exercise.questionContent !== ee.exercise.title && (
                  <div style={{ lineHeight: 1.8 }}>{ee.exercise.questionContent}</div>
                )}
                {renderOptions(ee)}
              </div>
            ))}

            {exercises.length === 0 && <Empty description="试卷暂无题目" />}
          </div>
          {showSealLine && sealPosition === "right" && (
            <div style={{ writingMode: "vertical-rl", borderLeft: "1px dashed #333", paddingLeft: 6, marginLeft: 12, letterSpacing: 8, color: "#333" }}>
              装订线 · 密封线内不要答题
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
