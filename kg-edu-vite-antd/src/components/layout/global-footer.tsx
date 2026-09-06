import React, { useEffect, useState } from "react";
import { Typography, Modal } from "antd";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/styles/theme-context";
import { useBranding } from "@/hooks/use-branding";
import { fetchSiteContent } from "@/lib/site-content";

const { Text } = Typography;

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
        padding: "24px 24px 48px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            textAlign: "center",
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 13,
              cursor: "pointer",
              transition: "color 0.2s",
            }}
            onClick={() => navigate("/about")}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
          >
            关于我们
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.3)", margin: "0 12px", fontSize: 13 }}>
            丨
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 13,
              cursor: "pointer",
              transition: "color 0.2s",
            }}
            onClick={() => setContactOpen(true)}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
          >
            联系我们
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.3)", margin: "0 12px", fontSize: 13 }}>
            丨
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 13,
              cursor: "pointer",
              transition: "color 0.2s",
            }}
            onClick={() => setPrivacyOpen(true)}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
          >
            隐私条款
          </Text>
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            marginTop: 16,
            paddingTop: 16,
            textAlign: "center",
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
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
