import React, { useEffect, useState } from "react";
import { Typography, Modal } from "antd";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/styles/theme-context";
import { useBranding } from "@/hooks/use-branding";
import { fetchSiteContent } from "@/lib/site-content";

const { Text } = Typography;

/** 页脚链接：固定行高 + 对称内边距，保证视觉间距完全一致 */
const FOOTER_LINK_STYLE: React.CSSProperties = {
  color: "rgba(255,255,255,0.8)",
  fontSize: 15,
  fontWeight: 500,
  lineHeight: "22px",
  padding: "4px 20px",
  cursor: "pointer",
  transition: "color 0.2s",
  userSelect: "none",
  whiteSpace: "nowrap",
};

function FooterLink({ label, onClick, style }: { label: string; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <Text
      style={{ ...FOOTER_LINK_STYLE, ...style }}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
    >
      {label}
    </Text>
  );
}

/** 链接之间的 1px 竖向分隔线（固定尺寸，不随文字变化） */
function FooterDivider() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)", flexShrink: 0 }}
    />
  );
}

const GlobalFooter: React.FC = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [siteContent, setSiteContent] = useState<{
    contactedEmail: string;
    contactedAddress: string;
    contactedHours: string;
    privacyPolicy: string;
  } | null>(null);
  const navigate = useNavigate();
  const { mode, colors } = useTheme();
  const branding = useBranding();
  const isPortal = mode === "portal";

  // 联系我们 / 隐私条款 — 超级管理员可在后台配置
  useEffect(() => {
    let active = true;
    fetchSiteContent().then((content) => {
      if (!active) return;
      setSiteContent({
        contactedEmail: content.contactEmail.trim(),
        contactedAddress: content.contactAddress.trim(),
        contactedHours: content.contactHours.trim(),
        privacyPolicy: content.privacyPolicy.trim(),
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const contactEmail = siteContent?.contactedEmail || "";
  const contactAddress = siteContent?.contactedAddress || "江苏省南京市";
  const contactHours = siteContent?.contactedHours || "工作日 9:00 - 18:00";
  const privacyPolicy = siteContent?.privacyPolicy ||
    "易课程·智慧教学系统及其所有内容，包括但不限于文字、图片、音频、视频、软件、程序、版面设计等，均受《中华人民共和国著作权法》及其他相关法律法规保护。未经书面授权，任何单位及个人不得以任何方式或理由对本平台内容进行使用、复制、修改、抄录或与其它产品捆绑使用。";

  return (
    <div
      style={{
        background: isPortal
          ? "linear-gradient(180deg, #0B4CA8 0%, #082F70 100%)"
          : colors.footerBg,
        color: "#FFFFFF",
        // 底部留白：滚到底时版权条不贴视口底边，避免像被裁掉
        padding: "28px 24px 48px",
      }}
    >
      {/* 同一居中容器：两行内容共用中线 */}
      <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
        {/* 第一行：链接，flex 严格居中 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FooterLink label="关于我们" onClick={() => navigate("/about")} />
          <FooterDivider />
          <FooterLink label="联系我们" onClick={() => setContactOpen(true)} />
          <FooterDivider />
          <FooterLink label="隐私条款" onClick={() => setPrivacyOpen(true)} />
        </div>

        {/* 第二行：版权文本，与链接行同容器居中，字号明显更小 */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.15)",
            marginTop: 18,
            paddingTop: 18,
            textAlign: "center",
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 11,
              lineHeight: 2,
            }}
          >
            {branding.app_copyright}
          </Text>
        </div>
      </div>

      <Modal
        title="联系我们"
        open={contactOpen}
        onCancel={() => setContactOpen(false)}
        footer={null}
        width={420}
      >
        <div style={{ lineHeight: 2.2, fontSize: 14 }}>
          <p>
            <strong>邮箱：</strong>{contactEmail}
          </p>
          <p>
            <strong>地址：</strong>{contactAddress}
          </p>
          <p style={{ color: "#8c8c8c", marginTop: 12, fontSize: 13 }}>
            {contactHours}
          </p>
        </div>
      </Modal>

      <Modal
        title="隐私条款"
        open={privacyOpen}
        onCancel={() => setPrivacyOpen(false)}
        footer={null}
        width={560}
      >
        <div style={{ lineHeight: 2, fontSize: 13, color: "#595959" }}>
          <p><strong>版权声明</strong></p>
          <p style={{ whiteSpace: "pre-line" }}>
            {privacyPolicy}
          </p>
          <p><strong>隐私保护</strong></p>
          <p>
            我们重视用户隐私保护。本平台收集的用户信息仅用于提供教学服务，不会向第三方出售、出租或以其他方式分享您的个人信息，法律法规要求或政府主管部门依法要求除外。
          </p>
          <p><strong>免责声明</strong></p>
          <p>
            本平台致力于提供准确的教育内容和服务，但不对内容的绝对准确性和完整性作出保证。用户因使用本平台内容而产生的任何直接或间接损失，本平台不承担法律责任。
          </p>
          <p style={{ color: "#8c8c8c", marginTop: 8 }}>
            最后更新日期：2026 年 1 月 1 日
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default GlobalFooter;
