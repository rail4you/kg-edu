import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  Button,
  Typography,
  Spin,
  Alert,
  Input,
  Space,
  Progress,
  Upload,
  message,
} from "antd";
import { CloudUploadOutlined, UploadOutlined, CloseOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useEditPermission } from "@/hooks/use-edit-permission";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function VideoUploader() {
  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName;
  const { canEdit } = useEditPermission();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);

  const [uploadUrl, setUploadUrl] = useState("");
  const [assetId, setAssetId] = useState("");
  const [playbackId, setPlaybackId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
      }
    };
  }, []);

  const createDirectUpload = async () => {
    try {
      setLoading(true);
      setStatus("Creating upload URL...");

      const authHeaders = getAuthHeaders(user) as Record<string, string>;
      const response = await fetch("http://localhost:4000/api/videos/upload", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log("Upload URL data:", data);
      setUploadUrl(data.url);
      setStatus("Ready to upload - select a video file");
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      console.error("Failed to create upload:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStatus(
        `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
      );
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadUrl) {
      message.error("Please select a file and create upload URL first");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      cancelledRef.current = false;
      setStatus("Uploading video...");

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      xhr.addEventListener("load", () => {
        if (cancelledRef.current) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          setAssetId(response.data?.id || response.id || "uploaded");
          setStatus(
            `Upload complete! Asset ID: ${response.data?.id || response.id || "N/A"}`,
          );
          message.success("Video uploaded successfully!");
        } else {
          setStatus(`Upload failed: ${xhr.statusText}`);
          message.error("Upload failed");
        }
        setUploading(false);
      });

      xhr.addEventListener("error", () => {
        if (cancelledRef.current) return;
        setStatus("Upload failed - network error");
        message.error("Upload failed");
        setUploading(false);
      });

      xhr.addEventListener("abort", () => {
        cancelledRef.current = true;
        setStatus("Upload cancelled");
        setUploading(false);
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", selectedFile.type);
      xhr.send(selectedFile);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      message.error("Upload failed");
      setUploading(false);
    }
  };

  const handleCancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
  };

  const generateVideoUrl = () => {
    if (playbackId) {
      const url = `https://image.mux.com/${playbackId}.mp4`;
      setVideoUrl(url);
      setStatus("Video URL generated!");
    } else {
      setStatus("Waiting for video processing... Check your backend webhooks.");
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 24 }}>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <Space>
              <CloudUploadOutlined />
              Upload Video
            </Space>
          </Title>

          {status && (
            <Alert
              type={
                status.includes("Error") || status.includes("failed")
                  ? "error"
                  : "info"
              }
              message={status}
              showIcon
            />
          )}

          <Button
            type="primary"
            onClick={createDirectUpload}
            disabled={loading || !!uploadUrl}
            block
            icon={loading ? <Spin size="small" /> : undefined}
            style={canEdit ? undefined : { display: "none" }}
          >
            {loading ? "Creating..." : "Create Upload URL"}
          </Button>

          {uploadUrl && (
            <div>
              <Text
                type="secondary"
                style={{ display: "block", marginBottom: 8 }}
              >
                Select a video file:
              </Text>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                style={{ marginBottom: 12 }}
                disabled={uploading}
              />

              {selectedFile && !uploading && canEdit && (
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={handleUpload}
                  block
                  style={{ marginTop: 8 }}
                >
                  Upload Video
                </Button>
              )}

              {uploading && (
                <div style={{ marginTop: 12 }}>
                  <Progress percent={uploadProgress} status="active" />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text type="secondary">Uploading... {uploadProgress}%</Text>
                    <Button
                      danger
                      icon={<CloseOutlined />}
                      onClick={handleCancelUpload}
                      size="small"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {assetId && <Input addonBefore="Asset ID" value={assetId} disabled />}

          <Input
            addonBefore="Playback ID"
            placeholder="Enter playback ID once processing completes"
            value={playbackId}
            onChange={(e) => setPlaybackId(e.target.value)}
          />

          <Button
            type="primary"
            style={{
              backgroundColor: "#52c41a",
              borderColor: "#52c41a",
              ...(canEdit ? {} : { display: "none" }),
            }}
            onClick={generateVideoUrl}
            disabled={!playbackId}
            block
          >
            Generate Video URL
          </Button>

          {videoUrl && <TextArea value={videoUrl} disabled rows={2} />}
        </Space>
      </Card>
    </div>
  );
}
