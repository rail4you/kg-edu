const STYLE_COLORS: Record<string, { outer: string; inner: string }> = {
  simple: { outer: "#8a8a86", inner: "#8a8a86" },
  classic: { outer: "#8c6a2f", inner: "#c9a765" },
  modern: { outer: "#0f6e56", inner: "#5dcaa5" },
};

export interface CertificateCardProps {
  style?: string | null;
  titleColor?: string | null;
  titleFont?: string | null;
  borderColor?: string | null;
  issuerName?: string | null;
  extraText?: string | null;
  logoUrl?: string | null;
  sealUrl?: string | null;
  signatureUrl?: string | null;
  studentName?: string;
  certNo?: string;
  microMajorName?: string;
  width?: number | string;
}

export default function CertificateCard({
  style = "simple",
  titleColor,
  titleFont,
  borderColor,
  issuerName,
  extraText,
  logoUrl,
  sealUrl,
  signatureUrl,
  studentName = "示例学员",
  certNo = "DEMO-2026-001",
  microMajorName = "微专业",
  width = 500,
}: CertificateCardProps) {
  const colors = STYLE_COLORS[style || "simple"] || STYLE_COLORS.simple;
  const outer = borderColor || colors.outer;

  return (
    <div style={{ padding: 8, border: `2px solid ${outer}`, borderRadius: 2, background: "#FBF9F3", width }}>
      <div style={{ padding: "24px 28px", border: `1px solid ${colors.inner}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center", border: logoUrl ? "none" : "1px dashed #b3b1a8" }}>
            {logoUrl ? (
              <img src={logoUrl} alt="logo" crossOrigin="anonymous" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 10, color: "#8a8a86" }}>logo</span>
            )}
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: "#7a7a74" }}>
            <div>编号: {certNo || "-"}</div>
            <div>日期: {new Date().toISOString().slice(0, 10)}</div>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <div style={{ fontFamily: titleFont || "ui-sans-serif, system-ui, sans-serif", fontSize: 26, letterSpacing: "4px", fontWeight: 500, color: titleColor || "#2b2b28" }}>
            结业证书
          </div>
          <div style={{ fontSize: 10, marginTop: 4, letterSpacing: 3, color: "#8a8a86" }}>结业证书</div>
        </div>
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, lineHeight: "2em", color: "#3a3a36" }}>
          兹证明 <span style={{ fontWeight: 500 }}>{studentName || "学生姓名"}</span> 同学在本机构学习期间，
          通过《{microMajorName || "微专业"}》微专业全部课程考核，
          达到毕业要求，特发此证，以资证明。
        </div>
        {extraText && (
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#8a8a86" }}>{extraText}</div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 28 }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ height: 28, display: "flex", alignItems: "flex-end", fontSize: 10, color: "#b3b1a8" }}>
              {signatureUrl ? (
                <img src={signatureUrl} alt="签名" crossOrigin="anonymous" referrerPolicy="no-referrer" style={{ height: 28, objectFit: "contain" }} />
              ) : "签名区"}
            </div>
            <div style={{ borderTop: "1px solid #8a8a86", fontSize: 11, color: "#3a3a36", paddingTop: 2 }}>
              签发人: {issuerName || "-"}
            </div>
          </div>
          <div style={{ width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, border: sealUrl ? "none" : "1px dashed #c99a9a", transform: "rotate(-6deg)", overflow: "hidden" }}>
            {sealUrl ? (
              <img src={sealUrl} alt="印章" crossOrigin="anonymous" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
            ) : "印章"}
          </div>
        </div>
      </div>
    </div>
  );
}
