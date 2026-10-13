import { useEffect, useState } from "react";
import { Spin } from "antd";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { pdfjs } from "react-pdf";

/**
 * 教材/文件「内容」文字预览：解析 Word / PDF / 文本 / 表格并展示正文。
 * 仅输出内容，不含容器；调用方负责限定高度与滚动。
 */
export default function BookContentPreview({
  url,
  name,
  mutedColor = "#64748b",
  textColor = "#424754",
}: {
  url: string;
  name: string;
  mutedColor?: string;
  textColor?: string;
}) {
  const [state, setState] = useState<{ loading: boolean; html?: string; text?: string; error?: string }>({
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState({ loading: true });
      try {
        const ext = (name.split(".").pop() || "").toLowerCase();
        if (ext === "docx" || ext === "doc") {
          const arrayBuffer = await (await fetch(url)).arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (!cancelled) setState({ loading: false, html: result.value?.trim() || "" });
        } else if (ext === "txt") {
          const text = await (await fetch(url)).text();
          if (!cancelled) setState({ loading: false, text });
        } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
          const arrayBuffer = await (await fetch(url)).arrayBuffer();
          const wb = XLSX.read(arrayBuffer, { type: "array" });
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
          if (!cancelled) setState({ loading: false, text: csv });
        } else if (ext === "pdf") {
          const doc = await pdfjs.getDocument(url).promise;
          let text = "";
          const pages = Math.min(doc.numPages, 8);
          for (let i = 1; i <= pages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            text += (content.items as any[]).map((it) => it.str).join(" ") + "\n\n";
          }
          if (!cancelled) setState({ loading: false, text: text.trim() });
        } else {
          if (!cancelled) setState({ loading: false, error: "该格式暂不支持内容预览" });
        }
      } catch {
        if (!cancelled) setState({ loading: false, error: "内容预览加载失败" });
      }
    };
    if (url) run();
    return () => {
      cancelled = true;
    };
  }, [url, name]);

  if (state.loading) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center" }}>
        <Spin size="small" />
      </div>
    );
  }
  if (state.error) {
    return <div style={{ fontSize: 12, color: mutedColor }}>{state.error}</div>;
  }
  if (state.html) {
    return (
      <>
        <style>{`
.book-content-html{font-size:13px;line-height:1.9;color:${textColor}}
.book-content-html h1{font-size:17px;font-weight:650;margin:14px 0 8px}
.book-content-html h2{font-size:15px;font-weight:650;margin:12px 0 6px}
.book-content-html h3{font-size:14px;font-weight:600;margin:10px 0 6px}
.book-content-html p{margin:0 0 10px}
.book-content-html ul,.book-content-html ol{margin:0 0 10px;padding-left:20px}
.book-content-html img{max-width:100%}
.book-content-html table{border-collapse:collapse;width:100%;font-size:12px}
.book-content-html td,.book-content-html th{border:1px solid #e3e9f1;padding:4px 8px}
        `}</style>
        <div className="book-content-html" dangerouslySetInnerHTML={{ __html: state.html }} />
      </>
    );
  }
  return (
    <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.9, color: textColor }}>
      {state.text?.trim() || "（暂无文本内容）"}
    </div>
  );
}
