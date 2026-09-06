import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as JSZip from 'jszip';
import {
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  ZoomIn,
  ZoomOut,
  Loader2,
  AlertCircle,
  PanelTopClose,
  PanelTopOpen,
} from 'lucide-react';

const toolDividerStyle: React.CSSProperties = {
  width: 1,
  height: 20,
  background: '#ececec',
  margin: '0 4px',
};

const toolBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: disabled ? '#c0c4cc' : '#4b5563',
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'background 0.15s, color 0.15s',
});

const toolBtnHover = (el: HTMLButtonElement) => {
  el.style.background = 'rgba(37, 115, 230, 0.08)';
  el.style.color = '#2573E6';
};

const toolBtnLeave = (el: HTMLButtonElement) => {
  el.style.background = 'transparent';
  el.style.color = '#4b5563';
};

const fabStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: '#fff',
  border: '1px solid #ececec',
  color: '#2573E6',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
  cursor: 'pointer',
  transition: 'transform 0.15s, box-shadow 0.15s',
};

const fabHover = (el: HTMLButtonElement) => {
  el.style.transform = 'scale(1.08)';
  el.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.18)';
};

const fabLeave = (el: HTMLButtonElement) => {
  el.style.transform = 'scale(1)';
  el.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
};

interface SlideBackground {
  type: string;
  color: string;
  data?: string;
}

interface SlideTextElement {
  text: string;
  fontSize: number;
  bold: boolean;
  index: number;
}

interface SlideImage {
  url: string;
  rId: string;
}

interface Slide {
  slideNum: number;
  background: SlideBackground;
  textElements: SlideTextElement[];
  images: SlideImage[];
}

interface PptxViewerProps {
  pptxUrl: string;
  toolbarContainer?: () => HTMLElement | null;
}

const PptxViewer: React.FC<PptxViewerProps> = ({ pptxUrl, toolbarContainer }) => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'grid'>('preview');
  const [hideToolbar, setHideToolbar] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [toolbarPortalEl, setToolbarPortalEl] = useState<HTMLElement | null>(null);
  const slideWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toolbarContainer) {
      setToolbarPortalEl(toolbarContainer() || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 让工具栏右边缘与 PPT 页面右边缘对齐（页面宽度随缩放变化时重新测量）
  useEffect(() => {
    const measure = () => {
      if (!toolbarPortalEl || !slideWrapRef.current) return;
      const row = toolbarPortalEl.parentElement;
      const slideEl = slideWrapRef.current.firstElementChild as HTMLElement | null;
      if (!row || !slideEl) return;
      const rowRight = row.getBoundingClientRect().right;
      const slideRight = slideEl.getBoundingClientRect().right;
      toolbarPortalEl.style.marginRight = `${Math.max(8, rowRight - slideRight)}px`;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [toolbarPortalEl, zoom, slides.length]);

  useEffect(() => {
    loadPptx();
  }, [pptxUrl]);

  const loadPptx = async () => {
    setLoading(true);
    setError(null);

    try {
      const JSZip = (await import('jszip')).default;

      const response = await fetch(pptxUrl, {
        mode: 'cors',
        headers: {
          Accept: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const zip = await JSZip.loadAsync(arrayBuffer);

      const parsedSlides = await parsePresentation(zip);
      setSlides(parsedSlides);
      setLoading(false);
    } catch (err) {
      console.error('PPTX Load Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load presentation');
      setLoading(false);
    }
  };

  const parsePresentation = async (zip: JSZip) => {
    const slides: Slide[] = [];

    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });

    const relationships = await parseRelationships(zip);
    const media = await extractMedia(zip);

    for (const slideFile of slideFiles) {
      const slideNum = parseInt(slideFile.match(/\d+/)?.[0] || '0');
      const xml = await zip.file(slideFile)?.async('text');
      if (xml) {
        const slide = parseSlide(xml, slideNum, relationships[slideNum], media);
        slides.push(slide);
      }
    }

    return slides;
  };

  const parseRelationships = async (zip: JSZip) => {
    const rels: Record<number, Record<string, string>> = {};

    const relFiles = Object.keys(zip.files).filter((name) =>
      /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(name)
    );

    for (const relFile of relFiles) {
      const slideNum = parseInt(relFile.match(/\d+/)?.[0] || '0');
      const xml = await zip.file(relFile)?.async('text');
      if (xml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        rels[slideNum] = {};
        doc.querySelectorAll('Relationship').forEach((rel) => {
          const id = rel.getAttribute('Id');
          const target = rel.getAttribute('Target');
          if (id && target) {
            rels[slideNum][id] = target;
          }
        });
      }
    }

    return rels;
  };

  const extractMedia = async (zip: JSZip) => {
    const media: Record<string, string> = {};

    const mediaFiles = Object.keys(zip.files).filter((name) =>
      name.startsWith('ppt/media/')
    );

    for (const file of mediaFiles) {
      const fileData = zip.file(file);
      if (fileData) {
        const blob = await fileData.async('blob');
        const url = URL.createObjectURL(blob);
        media[file] = url;
      }
    }

    return media;
  };

  const parseSlide = (
    xml: string,
    slideNum: number,
    rels: Record<string, string> = {},
    media: Record<string, string> = {}
  ): Slide => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const background = extractBackground(doc);
    const textElements = extractText(doc);
    const images = extractImages(doc, rels, media);

    return {
      slideNum,
      background,
      textElements,
      images,
    };
  };

  const extractBackground = (doc: Document): SlideBackground => {
    const bg = doc.querySelector('bg');
    if (!bg) return { type: 'solid', color: '#FFFFFF' };

    const solidFill = bg.querySelector('solidFill');
    if (solidFill) {
      const color = solidFill.querySelector('srgbClr');
      return {
        type: 'solid',
        color: color ? `#${color.getAttribute('val')}` : '#FFFFFF',
      };
    }

    const gradFill = bg.querySelector('gradFill');
    if (gradFill) {
      return { type: 'gradient', color: '#FFFFFF', data: 'linear-gradient(to bottom, #f0f0f0, #e0e0e0)' };
    }

    return { type: 'solid', color: '#FFFFFF' };
  };

  const extractText = (doc: Document) => {
    const elements: Array<{ text: string; fontSize: number; bold: boolean; index: number }> = [];
    const textNodes = doc.querySelectorAll('p');

    textNodes.forEach((p, idx) => {
      const runs = p.querySelectorAll('r');
      let text = '';
      let fontSize = 18;
      let bold = false;

      runs.forEach((r) => {
        const t = r.querySelector('t');
        if (t) {
          text += t.textContent;

          const rPr = r.querySelector('rPr');
          if (rPr) {
            const sz = rPr.getAttribute('sz');
            if (sz) fontSize = parseInt(sz) / 100;
            bold = rPr.querySelector('b') !== null;
          }
        }
      });

      if (text.trim()) {
        elements.push({ text, fontSize, bold, index: idx });
      }
    });

    return elements;
  };

  const extractImages = (doc: Document, rels: Record<string, string>, media: Record<string, string>) => {
    const images: Array<{ url: string; rId: string }> = [];
    const blips = doc.querySelectorAll('blip');

    blips.forEach((blip) => {
      const rId = blip.getAttribute('r:embed');
      if (rId && rels[rId]) {
        const mediaPath = `ppt/${rels[rId].replace('../', '')}`;
        if (media[mediaPath]) {
          images.push({ url: media[mediaPath], rId });
        }
      }
    });

    return images;
  };

  const nextSlide = () => setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  const prevSlide = () => setCurrentSlide((prev) => Math.max(prev - 1, 0));
  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 2));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'Escape' && hideToolbar) setHideToolbar(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [slides.length, viewMode, hideToolbar]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: 500,
          color: '#666',
        }}
      >
        <Loader2 className="animate-spin" style={{ width: 32, height: 32, marginBottom: 16 }} />
        <p>Loading presentation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: 500,
          color: '#ff4d4f',
        }}
      >
        <AlertCircle style={{ width: 48, height: 48, marginBottom: 16 }} />
        <p>{error}</p>
      </div>
    );
  }

  const emptySlide: Slide = {
    slideNum: 0,
    background: { type: 'solid', color: '#FFFFFF' },
    textElements: [],
    images: [],
  };

  const currentSlideData = slides[currentSlide] || emptySlide;
  const bg = currentSlideData.background || { type: 'solid', color: '#FFFFFF' };

  if (viewMode === 'grid') {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            onClick={() => setViewMode('preview')}
            style={{
              padding: '8px 16px',
              background: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            返回预览
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {slides.map((slide, idx) => (
            <div
              key={idx}
              onClick={() => {
                setCurrentSlide(idx);
                setViewMode('preview');
              }}
              style={{
                cursor: 'pointer',
                background: '#f5f5f5',
                padding: 8,
                borderRadius: 8,
                border: '1px solid #d9d9d9',
              }}
            >
              <div
                style={{
                  aspectRatio: '16/9',
                  position: 'relative',
                  background: slide.background.type === 'solid' ? slide.background.color : slide.background.data,
                  borderRadius: 4,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: slide.background.color === '#FFFFFF' ? '#000' : '#FFF', fontSize: 12 }}>
                  {slide.textElements?.[0]?.text || `Slide ${idx + 1}`}
                </span>
              </div>
              <p style={{ marginTop: 8, fontSize: 14 }}>Slide {idx + 1}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const toolbarContent = hideToolbar ? (
    <button
      onClick={() => setHideToolbar(false)}
      title="显示工具栏"
      style={fabStyle}
      onMouseEnter={(e) => fabHover(e.currentTarget)}
      onMouseLeave={(e) => fabLeave(e.currentTarget)}
    >
      <PanelTopOpen size={18} />
    </button>
  ) : (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '6px 8px',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: '1px solid #ececec',
      }}
    >
      <div style={{ padding: '0 10px', minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#4b5563',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          {currentSlide + 1} / {slides.length} 页
        </div>
      </div>

      <div style={toolDividerStyle} />

      <button
        onClick={prevSlide}
        disabled={currentSlide === 0}
        title="上一页 (←)"
        style={toolBtnStyle(currentSlide === 0)}
        onMouseEnter={(e) => toolBtnHover(e.currentTarget)}
        onMouseLeave={(e) => toolBtnLeave(e.currentTarget)}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={nextSlide}
        disabled={currentSlide === slides.length - 1}
        title="下一页 (→)"
        style={toolBtnStyle(currentSlide === slides.length - 1)}
        onMouseEnter={(e) => toolBtnHover(e.currentTarget)}
        onMouseLeave={(e) => toolBtnLeave(e.currentTarget)}
      >
        <ChevronRight size={16} />
      </button>

      <div style={toolDividerStyle} />

      <button
        onClick={zoomOut}
        title="缩小"
        style={toolBtnStyle(false)}
        onMouseEnter={(e) => toolBtnHover(e.currentTarget)}
        onMouseLeave={(e) => toolBtnLeave(e.currentTarget)}
      >
        <ZoomOut size={16} />
      </button>
      <span
        style={{
          fontSize: 12,
          minWidth: 38,
          textAlign: 'center',
          color: '#4b5563',
          fontVariantNumeric: 'tabular-nums',
          userSelect: 'none',
        }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={zoomIn}
        title="放大"
        style={toolBtnStyle(false)}
        onMouseEnter={(e) => toolBtnHover(e.currentTarget)}
        onMouseLeave={(e) => toolBtnLeave(e.currentTarget)}
      >
        <ZoomIn size={16} />
      </button>

      <div style={toolDividerStyle} />

      <button
        onClick={() => setViewMode('grid')}
        title="幻灯片预览"
        style={toolBtnStyle(false)}
        onMouseEnter={(e) => toolBtnHover(e.currentTarget)}
        onMouseLeave={(e) => toolBtnLeave(e.currentTarget)}
      >
        <Grid3x3 size={16} />
      </button>
      <button
        onClick={() => setHideToolbar(true)}
        title="隐藏工具栏"
        style={toolBtnStyle(false)}
        onMouseEnter={(e) => toolBtnHover(e.currentTarget)}
        onMouseLeave={(e) => toolBtnLeave(e.currentTarget)}
      >
        <PanelTopClose size={16} />
      </button>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      {toolbarPortalEl
        ? createPortal(toolbarContent, toolbarPortalEl)
        : (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            {toolbarContent}
          </div>
        )}

      <div ref={slideWrapRef} style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: 800 * zoom,
            height: 450 * zoom,
            background: bg.type === 'solid' ? bg.color : bg.data,
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {currentSlideData.images?.map((img, idx) => (
            <img
              key={idx}
              src={img.url}
              alt=""
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                padding: 16,
              }}
            />
          ))}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            {currentSlideData.textElements?.map((el, idx) => (
              <p
                key={idx}
                style={{
                  fontSize: el.fontSize * zoom,
                  fontWeight: el.bold ? 'bold' : 'normal',
                  color: bg.color === '#FFFFFF' ? '#000' : '#FFF',
                  margin: 0,
                }}
              >
                {el.text}
              </p>
            ))}
          </div>
        </div>
      </div>

      {!hideToolbar && (
        <div style={{ textAlign: 'center', marginTop: 12, color: '#9ca3af', fontSize: 12 }}>
          使用 ← → 方向键快速翻页
        </div>
      )}
    </div>
  );
};

export default PptxViewer;
