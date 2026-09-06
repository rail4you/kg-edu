import { useState, useEffect, useRef } from "react";
import {
  Modal,
  Button,
  Spin,
  Space,
  Typography,
  Tabs,
} from "antd";
import {
  DownloadOutlined,
  LeftOutlined,
  RightOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { Document, Page, pdfjs } from "react-pdf";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import PptxViewer from "./PptxViewer";

const { Text, Title } = Typography;

pdfjs.GlobalWorkerOptions.workerSrc = "https://fastly.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs";

interface FilePreviewProps {
  open: boolean;
  onClose: () => void;
  file: {
    url: string;
    name: string;
    type: string;
    size?: number;
  };
  onDownload?: () => void;
}

export default function FilePreview({ open, onClose, file, onDownload }: FilePreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    type: string;
    html?: string;
    text?: string;
    sheets?: Array<{
      name: string;
      data: unknown[][];
      rows: number;
      cols: number;
    }>;
  } | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [excelZoom, setExcelZoom] = useState(1.0);
  const pptxToolbarRef = useRef<HTMLDivElement>(null);

  const getFileType = (filename: string, mimeType?: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext && ["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "jpg", "jpeg", "png", "gif", "bmp", "webp", "mp4", "webm", "avi", "mov", "mkv"].includes(ext)) {
      return ext;
    }

    if (mimeType) {
      const mimeToExt: Record<string, string> = {
        "application/pdf": "pdf",
        "application/msword": "doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.ms-excel": "xls",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "application/vnd.ms-powerpoint": "ppt",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
        "text/plain": "txt",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/bmp": "bmp",
        "image/webp": "webp",
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/x-msvideo": "avi",
        "video/quicktime": "mov",
        "video/x-matroska": "mkv",
      };
      return mimeToExt[mimeType] || "";
    }

    return ext || "";
  };

  const fileType = file ? getFileType(file.name, file.type) : "";

  useEffect(() => {
    if (open && file && file.url) {
      loadFilePreview();
    }
    return () => {
      setPreviewData(null);
      setError(null);
      setPageNumber(1);
      setScale(1.0);
    };
  }, [open, file?.url, file?.name]);

  const loadFilePreview = async () => {
    setLoading(true);
    setError(null);

    try {
      switch (fileType) {
        case "pdf":
          setLoading(false);
          break;

        case "docx":
        case "doc":
          await loadDocxPreview();
          break;

        case "xlsx":
        case "xls":
        case "csv":
          await loadExcelPreview();
          break;

        case "txt":
          await loadTextPreview();
          break;

        case "pptx":
        case "ppt":
          await loadPptxPreview();
          break;

        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
        case "bmp":
        case "webp":
          setLoading(false);
          break;

        case "mp4":
        case "webm":
        case "avi":
        case "mov":
        case "mkv":
          setLoading(false);
          break;

        default:
          setLoading(false);
          setError("此文件类型不支持预览");
      }
    } catch {
      setError("加载文件预览失败");
      setLoading(false);
    }
  };

  const loadDocxPreview = async () => {
    if (!file?.url) throw new Error("File URL is missing");
    try {
      const response = await fetch(file.url);
      let arrayBuffer = await response.arrayBuffer();

      // 尝试修复损坏的 XML（如无效的数字标签 <0/>, <1/> 等）
      try {
        const zip = await import("jszip");
        const zipContent = await zip.loadAsync(arrayBuffer);
        let documentXml = await zipContent.file("word/document.xml")?.async("string");

        if (documentXml) {
          // 修复无效的数字标签（如 <0/>, <1/> 等）
          const originalLength = documentXml.length;
          documentXml = documentXml.replace(/<\d+\/>/g, "");
          if (documentXml.length !== originalLength) {
            console.log("Fixed invalid XML tags in docx file");
          }

          // 更新 zip 中的文件
          zipContent.file("word/document.xml", documentXml);
          arrayBuffer = await zipContent.generateAsync({ type: "arraybuffer" });
        }
      } catch (zipError) {
        console.warn("Could not attempt XML repair:", zipError);
        // 继续使用原始 arrayBuffer
      }

      const result = await mammoth.convertToHtml({ arrayBuffer }, {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
        ],
      });
      if (result.value && result.value.trim()) {
        setPreviewData({ html: result.value, type: "html" });
      } else {
        setError("文档内容为空");
      }
    } catch {
      setError("Word 文档解析失败");
    } finally {
      setLoading(false);
    }
  };

  const loadExcelPreview = async () => {
    if (!file?.url) throw new Error("File URL is missing");
    try {
      const response = await fetch(file.url);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellStyles: true, cellFormula: true });
      const sheetNames = workbook.SheetNames;
      
      const sheets = sheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
        
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
        const cols = range.e.c + 1;
        const rows = range.e.r + 1;
        
        return {
          name,
          data,
          cols,
          rows,
        };
      });
      
      setPreviewData({ sheets, type: "excel" });
    } catch {
      setError("Excel 文件解析失败");
    } finally {
      setLoading(false);
    }
  };

  const loadTextPreview = async () => {
    if (!file?.url) throw new Error("File URL is missing");
    try {
      const response = await fetch(file.url);
      const text = await response.text();
      setPreviewData({ text, type: "text" });
    } catch {
      setError("文本文件加载失败");
    } finally {
      setLoading(false);
    }
  };

  const loadPptxPreview = async () => {
    setLoading(false);
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else if (file?.url && file?.name) {
      const link = document.createElement("a");
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const onDocumentLoadSuccess = ({ numPages: num }: { numPages: number }) => {
    setNumPages(num);
  };

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPageNumber = prevPageNumber + offset;
      if (newPageNumber < 1) return 1;
      if (numPages && newPageNumber > numPages) return numPages;
      return newPageNumber;
    });
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case "pdf":
        return "PDF 文档";
      case "docx":
      case "doc":
        return "Word 文档";
      case "xlsx":
      case "xls":
        return "Excel 表格";
      case "csv":
        return "CSV 文件";
      case "pptx":
      case "ppt":
        return "PowerPoint 演示文稿";
      case "txt":
        return "文本文件";
      case "jpg":
      case "jpeg":
        return "JPEG 图片";
      case "png":
        return "PNG 图片";
      case "gif":
        return "GIF 图片";
      case "bmp":
        return "BMP 图片";
      case "webp":
        return "WebP 图片";
      case "mp4":
        return "MP4 视频";
      case "webm":
        return "WebM 视频";
      case "avi":
        return "AVI 视频";
      case "mov":
        return "MOV 视频";
      case "mkv":
        return "MKV 视频";
      default:
        return "文件";
    }
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 500 }}>
          <Spin size="large" />
          <Text style={{ marginLeft: 16 }}>加载预览中...</Text>
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 500, flexDirection: "column" }}>
          <FileTextOutlined style={{ fontSize: 48, color: "#ff4d4f", marginBottom: 16 }} />
          <Text type="danger">{error}</Text>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} style={{ marginTop: 16 }}>
            下载文件
          </Button>
        </div>
      );
    }

    switch (fileType) {
      case "pdf":
        if (!file?.url) {
          return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 500 }}>
              <div style={{ padding: 16 }}><Text type="danger">文件URL缺失</Text></div>
            </div>
          );
        }
        if (error) {
          return (
            <div style={{ textAlign: "center", padding: 20 }}>
              <Text type="danger" style={{ display: "block", marginBottom: 16 }}>{error}</Text>
              <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                该PDF可能包含特殊字体或编码，建议下载后使用专业PDF阅读器查看
              </Text>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
                下载文件
              </Button>
            </div>
          );
        }
        return (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center", gap: 8 }}>
              <Button icon={<ZoomOutOutlined />} onClick={zoomOut} disabled={scale <= 0.5} size="small">
                缩小
              </Button>
              <Text style={{ display: "flex", alignItems: "center" }}>{Math.round(scale * 100)}%</Text>
              <Button icon={<ZoomInOutlined />} onClick={zoomIn} disabled={scale >= 3.0} size="small">
                放大
              </Button>
              <Button icon={<LeftOutlined />} onClick={previousPage} disabled={pageNumber <= 1} size="small">
                上一页
              </Button>
              <Text style={{ display: "flex", alignItems: "center" }}>
                第 {pageNumber} 页，共 {numPages || "-"} 页
              </Text>
              <Button icon={<RightOutlined />} onClick={nextPage} disabled={!numPages || pageNumber >= numPages} size="small">
                下一页
              </Button>
            </div>
            <Document 
              file={file.url} 
              onLoadSuccess={onDocumentLoadSuccess} 
              onLoadError={(err: Error) => {
                console.error("PDF load error:", err);
                setError("PDF加载失败，该文件可能包含不支持的字体或编码格式");
              }}
              onSourceError={(err: Error) => {
                console.error("PDF source error:", err);
                setError("无法获取PDF文件，请检查网络连接");
              }}
              options={{
                cMapUrl: "https://fastly.jsdelivr.net/npm/pdfjs-dist@5.4.296/cmaps/",
                cMapPacked: true,
                standardFontDataUrl: "https://fastly.jsdelivr.net/npm/pdfjs-dist@5.4.296/standard_fonts/",
                useSystemFonts: true,
                isEvalSupported: false,
                useWorkerFetch: true,
              }}
              loading={<div style={{ padding: 40, textAlign: "center" }}><Spin size="large" /><div style={{ marginTop: 10 }}>加载PDF中...</div></div>}
              noData={<div style={{ padding: 20 }}><Text>PDF文件为空</Text></div>}
            >
              <Page 
                pageNumber={pageNumber} 
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading={<div style={{ padding: 20 }}><Spin /></div>}
                error="页面加载失败"
              />
            </Document>
          </div>
        );

      case "docx":
      case "doc":
        if (previewData?.type === "html" && previewData?.html) {
          return (
            <div 
              style={{ 
                padding: 24, 
                maxHeight: 500, 
                overflow: "auto",
                lineHeight: 1.6,
              }}
              dangerouslySetInnerHTML={{ __html: previewData.html }}
            />
          );
        }
        break;

      case "xlsx":
      case "xls":
      case "csv":
        if (previewData?.type === "excel" && previewData?.sheets) {
          return (
            <div style={{ width: "100%" }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                padding: "8px 16px",
                borderBottom: "1px solid #f0f0f0",
                backgroundColor: "#fafafa"
              }}>
                <Tabs 
                  activeKey={String(tabValue)} 
                  onChange={(v) => setTabValue(Number(v))}
                  size="small"
                  items={previewData.sheets.map((sheet, index) => ({
                    key: String(index),
                    label: (
                      <span>
                        {sheet.name} 
                        <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                          {sheet.rows}×{sheet.cols}
                        </Text>
                      </span>
                    ),
                  }))}
                />
                <Space>
                  <Button 
                    size="small" 
                    onClick={() => setExcelZoom(prev => Math.max(0.5, prev - 0.1))}
                    disabled={excelZoom <= 0.5}
                  >
                    -
                  </Button>
                  <Text style={{ fontSize: 12 }}>{Math.round(excelZoom * 100)}%</Text>
                  <Button 
                    size="small" 
                    onClick={() => setExcelZoom(prev => Math.min(2, prev + 0.1))}
                    disabled={excelZoom >= 2}
                  >
                    +
                  </Button>
                </Space>
              </div>
              {previewData.sheets.map((sheet, index) => (
                tabValue === index && (
                  <div 
                    key={String(index)} 
                    style={{ 
                      maxHeight: "60vh", 
                      overflow: "auto", 
                      padding: 0,
                      transform: `scale(${excelZoom})`,
                      transformOrigin: "top left",
                      width: `${100 / excelZoom}%`,
                    }}
                  >
                    <Text type="secondary" style={{ padding: "8px 16px", display: "block", backgroundColor: "#f5f5f5" }}>
                      共 {sheet.rows} 行 × {sheet.cols} 列
                    </Text>
                    <table style={{ 
                      borderCollapse: "collapse", 
                      width: "100%", 
                      fontSize: 12, 
                      tableLayout: "auto"
                    }}>
                      <tbody>
                        {sheet.data.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            <td 
                              style={{ 
                                border: "1px solid #ddd", 
                                padding: "4px 8px",
                                backgroundColor: "#f0f0f0",
                                fontWeight: "bold",
                                width: 50,
                                textAlign: "center",
                                color: "#666",
                                fontSize: 11,
                                position: "sticky",
                                left: 0,
                                zIndex: 1,
                              }}
                            >
                              {rowIndex + 1}
                            </td>
                            {row.map((cell, cellIndex) => {
                              const cellStr = cell !== undefined && cell !== null ? String(cell) : "";
                              const cellLength = cellStr.length;
                              const colWidth = Math.min(Math.max(cellLength * 8 + 20, 60), 300);
                              return (
                                <td
                                  key={cellIndex}
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "4px 8px",
                                    backgroundColor: rowIndex === 0 ? "#e6f7ff" : "inherit",
                                    fontWeight: rowIndex === 0 ? "bold" : "normal",
                                    minWidth: colWidth,
                                    maxWidth: colWidth,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={cellStr}
                                >
                                  {cellStr}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ))}
            </div>
          );
        }
        break;

      case "txt":
        if (previewData?.type === "text" && previewData?.text) {
          return (
            <div style={{ padding: 16, maxHeight: 500, overflow: "auto" }}>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 14 }}>
                {previewData.text}
              </pre>
            </div>
          );
        }
        break;

case "pptx":
        case "ppt":
          if (file?.url) {
            return <PptxViewer pptxUrl={file.url} toolbarContainer={() => pptxToolbarRef.current} />;
          }
          break;

      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "bmp":
      case "webp":
        if (!file?.url) {
          return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 500 }}>
              <div style={{ padding: 16 }}><Text type="danger">文件URL缺失</Text></div>
            </div>
          );
        }
        return (
          <div style={{ textAlign: "center", padding: 16 }}>
            <img
              src={file.url}
              alt={file.name || "Image"}
              style={{
                maxWidth: "100%",
                maxHeight: 500,
                objectFit: "contain",
              }}
            />
          </div>
        );

      case "mp4":
      case "webm":
      case "avi":
      case "mov":
      case "mkv":
        if (!file?.url) {
          return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 500 }}>
              <div style={{ padding: 16 }}><Text type="danger">文件URL缺失</Text></div>
            </div>
          );
        }
        return (
          <div style={{ textAlign: "center", padding: 16 }}>
            <video controls style={{ maxWidth: "100%", maxHeight: 500 }}>
              <source src={file.url} type={`video/${fileType}`} />
              您的浏览器不支持视频播放。
            </video>
          </div>
        );

      default:
        return (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 500, flexDirection: "column" }}>
            <FileTextOutlined style={{ fontSize: 64, color: "#bfbfbf", marginBottom: 16 }} />
            <Title level={5} type="secondary">
              文件预览
            </Title>
            <Text type="secondary" style={{ marginBottom: 16 }}>
              此文件类型不支持预览
            </Text>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
              下载文件
            </Button>
          </div>
        );
    }

    return null;
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        ["pptx", "ppt"].includes(fileType) ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              paddingRight: 8,
            }}
          >
            <div>
              <Text strong style={{ fontSize: 16 }}>文件预览</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {getFileTypeLabel(fileType)} {file?.size && `(${(file.size / 1024 / 1024).toFixed(2)} MB)`}
              </Text>
            </div>
            <div ref={pptxToolbarRef} style={{ display: "flex", alignItems: "center" }} />
          </div>
        ) : (
          <div>
            <Text strong style={{ fontSize: 16 }}>文件预览</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {getFileTypeLabel(fileType)} {file?.size && `(${(file.size / 1024 / 1024).toFixed(2)} MB)`}
            </Text>
          </div>
        )
      }
      footer={[
        <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownload} disabled={!file?.url}>
          下载
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={["docx", "doc", "pptx", "ppt"].includes(fileType) ? 1000 : 900}
      style={{ top: 20 }}
      destroyOnHidden
      styles={{ body: { padding: 0, overflow: "hidden", maxHeight: "70vh", overflowY: "auto" } }}
    >
      {renderPreview()}
    </Modal>
  );
}
