import React, { useState, useRef, useCallback } from "react";
import { Modal, Upload, Button, message, Spin } from "antd";
import { UploadOutlined, ScissorOutlined, ReloadOutlined } from "@ant-design/icons";
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { uploadFile } from "@/lib/oss-upload";

interface ImageCropperProps {
  value?: string;
  onChange?: (url: string) => void;
  aspectRatio?: number;
  maxWidth?: number;
  maxHeight?: number;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export default function ImageCropper({
  value,
  onChange,
  aspectRatio = 16 / 9,
  maxWidth = 800,
  maxHeight = 450,
}: ImageCropperProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleSelectFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setImgSrc(reader.result?.toString() || "");
      setModalOpen(true);
    });
    reader.readAsDataURL(file);
    return false;
  }, []);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspectRatio));
    },
    [aspectRatio]
  );

  const getCroppedImg = useCallback(
    async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("No 2d context");
      }

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const cropWidth = crop.width * scaleX;
      const cropHeight = crop.height * scaleY;

      let finalWidth = cropWidth;
      let finalHeight = cropHeight;

      if (finalWidth > maxWidth || finalHeight > maxHeight) {
        const ratio = Math.min(maxWidth / finalWidth, maxHeight / finalHeight);
        finalWidth = finalWidth * ratio;
        finalHeight = finalHeight * ratio;
      }

      canvas.width = finalWidth;
      canvas.height = finalHeight;

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        cropWidth,
        cropHeight,
        0,
        0,
        finalWidth,
        finalHeight
      );

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas is empty"));
              return;
            }
            resolve(blob);
          },
          "image/jpeg",
          0.9
        );
      });
    },
    [maxWidth, maxHeight]
  );

  const handleConfirmCrop = async () => {
    if (!completedCrop || !imgRef.current) {
      message.warning("请先选择裁剪区域");
      return;
    }

    try {
      setUploading(true);
      const blob = await getCroppedImg(imgRef.current, completedCrop);
      const file = new File([blob], `cover_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      const result = await uploadFile(file);
      onChange?.(result.url);
      message.success("封面图片上传成功");
      setModalOpen(false);
      setImgSrc("");
    } catch (error) {
      console.error("Upload error:", error);
      message.error("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    onChange?.("");
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        {value ? (
          <div
            style={{
              position: "relative",
              display: "inline-block",
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid #d9d9d9",
            }}
          >
            <img
              src={value}
              alt="封面预览"
              style={{
                maxWidth: "100%",
                maxHeight: 200,
                display: "block",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                justifyContent: "center",
                gap: 8,
                padding: "4px 0",
              }}
            >
              <Button
                size="small"
                icon={<ScissorOutlined />}
                onClick={() => setModalOpen(true)}
                style={{ color: "#fff", background: "transparent", border: "none" }}
              >
                重新裁剪
              </Button>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleClear}
                style={{ color: "#fff", background: "transparent", border: "none" }}
              >
                清除
              </Button>
            </div>
          </div>
        ) : (
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={handleSelectFile}
          >
            <Button icon={<UploadOutlined />}>上传封面图片</Button>
          </Upload>
        )}
      </div>

      <Modal
        open={modalOpen}
        title="选择封面区域"
        width={800}
        onCancel={() => {
          setModalOpen(false);
          if (!value) setImgSrc("");
        }}
        onOk={handleConfirmCrop}
        okText="确认裁剪"
        cancelText="取消"
        confirmLoading={uploading}
        maskClosable={false}
      >
        <Spin spinning={uploading} tip="正在上传...">
          {imgSrc && (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
              minWidth={100}
              minHeight={60}
            >
              <img
                ref={imgRef}
                alt="Crop preview"
                src={imgSrc}
                style={{ maxWidth: "100%", maxHeight: 500 }}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          )}
          {!imgSrc && value && (
            <div style={{ marginBottom: 12 }}>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={handleSelectFile}
              >
                <Button icon={<UploadOutlined />}>重新选择图片</Button>
              </Upload>
            </div>
          )}
          {imgSrc && (
            <div style={{ marginTop: 12, color: "#888", fontSize: 12 }}>
              提示：拖动选择框调整裁剪区域，支持 16:9 比例的封面图片
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
}
