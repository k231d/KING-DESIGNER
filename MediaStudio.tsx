import { useState, useRef, useEffect, useCallback } from 'react';
import { Crop, Sliders, RotateCw, Sun, Contrast, Droplet, Check, X, Undo2 } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

export interface StudioEdit {
  filter: string;
  brightness: number;
  contrast: number;
  saturation: number;
  rotation: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

export const DEFAULT_EDIT: StudioEdit = {
  filter: 'none',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  rotation: 0,
  cropX: 0,
  cropY: 0,
  cropW: 100,
  cropH: 100,
};

const FILTERS = [
  { id: 'none', labelKey: 'filterNone', css: 'none' },
  { id: 'grayscale', labelKey: 'filterGrayscale', css: 'grayscale(1)' },
  { id: 'sepia', labelKey: 'filterSepia', css: 'sepia(0.8)' },
  { id: 'warm', labelKey: 'filterWarm', css: 'sepia(0.3) saturate(1.4) hue-rotate(-10deg)' },
  { id: 'cool', labelKey: 'filterCool', css: 'saturate(1.2) hue-rotate(180deg) brightness(1.05)' },
  { id: 'vintage', labelKey: 'filterVintage', css: 'sepia(0.5) contrast(1.1) brightness(0.9) saturate(0.8)' },
  { id: 'vivid', labelKey: 'filterVivid', css: 'saturate(1.8) contrast(1.15)' },
];

function getFilterCss(edit: StudioEdit): string {
  const filterDef = FILTERS.find((f) => f.id === edit.filter);
  const base = filterDef ? filterDef.css : 'none';
  if (edit.filter === 'none') {
    return `brightness(${edit.brightness}%) contrast(${edit.contrast}%) saturate(${edit.saturation}%)`;
  }
  return `${base} brightness(${edit.brightness}%) contrast(${edit.contrast}%) saturate(${edit.saturation}%)`;
}

interface MediaStudioProps {
  imageUrl: string;
  onApply: (edit: StudioEdit) => void;
  onClose: () => void;
}

export function MediaStudio({ imageUrl, onApply, onClose }: MediaStudioProps) {
  const { t } = useLang();
  const [edit, setEdit] = useState<StudioEdit>(DEFAULT_EDIT);
  const [tab, setTab] = useState<'crop' | 'filters' | 'adjust'>('filters');
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filterCss = getFilterCss(edit);

  const updateEdit = (partial: Partial<StudioEdit>) => setEdit((e) => ({ ...e, ...partial }));

  const handleCropStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const point = 'touches' in e ? e.touches[0] : e;
    setCropStart({ x: point.clientX - rect.left, y: point.clientY - rect.top });
    setCropEnd({ x: point.clientX - rect.left, y: point.clientY - rect.top });
  }, []);

  const handleCropMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!cropStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const point = 'touches' in e ? e.touches[0] : e;
    setCropEnd({ x: point.clientX - rect.left, y: point.clientY - rect.top });
  }, [cropStart]);

  const handleCropEnd = useCallback(() => {
    if (!cropStart || !cropEnd || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const w = Math.abs(cropEnd.x - cropStart.x);
    const h = Math.abs(cropEnd.y - cropStart.y);
    if (w < 20 || h < 20) {
      setCropStart(null);
      setCropEnd(null);
      return;
    }
    updateEdit({
      cropX: (x / rect.width) * 100,
      cropY: (y / rect.height) * 100,
      cropW: (w / rect.width) * 100,
      cropH: (h / rect.height) * 100,
    });
    setCropStart(null);
    setCropEnd(null);
  }, [cropStart, cropEnd]);

  const cropStyle = (() => {
    if (!cropStart || !cropEnd) return null;
    const left = Math.min(cropStart.x, cropEnd.x);
    const top = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);
    return { left, top, width, height };
  })();

  const appliedCropStyle = edit.cropW < 100 || edit.cropH < 100
    ? {
        left: `${edit.cropX}%`,
        top: `${edit.cropY}%`,
        width: `${edit.cropW}%`,
        height: `${edit.cropH}%`,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-king-100 dark:border-surface-dark-border">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('mediaStudio')}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEdit(DEFAULT_EDIT)}
              className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg text-gray-500"
              title={t('resetChanges')}
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div
          ref={containerRef}
          className="relative w-full aspect-square bg-gray-100 dark:bg-surface-dark-alt overflow-hidden flex items-center justify-center"
          onMouseDown={tab === 'crop' ? handleCropStart : undefined}
          onMouseMove={tab === 'crop' ? handleCropMove : undefined}
          onMouseUp={tab === 'crop' ? handleCropEnd : undefined}
          onMouseLeave={tab === 'crop' ? handleCropEnd : undefined}
          onTouchStart={tab === 'crop' ? handleCropStart : undefined}
          onTouchMove={tab === 'crop' ? handleCropMove : undefined}
          onTouchEnd={tab === 'crop' ? handleCropEnd : undefined}
          style={{ cursor: tab === 'crop' ? 'crosshair' : 'default' }}
        >
          <div className="relative w-full h-full overflow-hidden">
            <img
              ref={imgRef}
              src={imageUrl}
              alt="editing"
              className="w-full h-full object-contain"
              style={{ filter: filterCss, transform: `rotate(${edit.rotation}deg)` }}
            />
            {appliedCropStyle && (
              <div className="absolute border-2 border-king-400 pointer-events-none" style={appliedCropStyle}>
                <div className="absolute inset-0 border border-white/50" />
              </div>
            )}
            {cropStyle && (
              <div className="absolute border-2 border-king-500 bg-king-500/10 pointer-events-none" style={cropStyle} />
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-king-100 dark:border-surface-dark-border">
          {([
            { id: 'filters', icon: Sliders, label: t('filters') },
            { id: 'crop', icon: Crop, label: t('crop') },
            { id: 'adjust', icon: Sun, label: t('adjust') },
          ] as const).map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                tab === tb.id
                  ? 'text-king-600 dark:text-king-400 border-b-2 border-king-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-king-500'
              }`}
            >
              <tb.icon className="w-4 h-4" />
              {tb.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4">
          {tab === 'filters' && (
            <div className="grid grid-cols-4 gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => updateEdit({ filter: f.id })}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-all ${
                    edit.filter === f.id
                      ? 'bg-king-100 dark:bg-surface-dark-alt ring-2 ring-king-500'
                      : 'hover:bg-king-50 dark:hover:bg-surface-dark-alt'
                  }`}
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 dark:bg-surface-dark-alt">
                    <img
                      src={imageUrl}
                      alt={f.id}
                      className="w-full h-full object-cover"
                      style={{ filter: f.css === 'none' ? 'none' : f.css }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{t(f.labelKey as 'filterNone')}</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'crop' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {t('crop')} - {lang_crop_hint()}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => updateEdit({ rotation: (edit.rotation + 90) % 360 })}
                  className="flex items-center gap-1.5 text-sm text-king-600 dark:text-king-400 bg-king-50 dark:bg-surface-dark-alt rounded-lg px-3 py-2 hover:bg-king-100 dark:hover:bg-surface-dark-card transition-colors"
                >
                  <RotateCw className="w-4 h-4" /> {t('rotate')}
                </button>
                <button
                  onClick={() => updateEdit({ cropX: 0, cropY: 0, cropW: 100, cropH: 100 })}
                  className="text-sm text-gray-500 hover:text-king-500 rounded-lg px-3 py-2 transition-colors"
                >
                  {t('resetChanges')}
                </button>
              </div>
            </div>
          )}

          {tab === 'adjust' && (
            <div className="space-y-4">
              <AdjustSlider
                icon={<Sun className="w-4 h-4 text-king-500" />}
                label={t('brightness')}
                value={edit.brightness}
                min={50}
                max={150}
                onChange={(v) => updateEdit({ brightness: v })}
              />
              <AdjustSlider
                icon={<Contrast className="w-4 h-4 text-king-500" />}
                label={t('contrast')}
                value={edit.contrast}
                min={50}
                max={150}
                onChange={(v) => updateEdit({ contrast: v })}
              />
              <AdjustSlider
                icon={<Droplet className="w-4 h-4 text-king-500" />}
                label={t('saturation')}
                value={edit.saturation}
                min={0}
                max={200}
                onChange={(v) => updateEdit({ saturation: v })}
              />
            </div>
          )}
        </div>

        {/* Apply button */}
        <div className="p-4 border-t border-king-100 dark:border-surface-dark-border">
          <button
            onClick={() => onApply(edit)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {t('applyChanges')}
          </button>
        </div>
      </div>
    </div>
  );

  function lang_crop_hint() {
    return t('crop');
  }
}

function AdjustSlider({
  icon,
  label,
  value,
  min,
  max,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
        <span className="text-xs text-gray-400 ml-auto">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-king-500"
      />
    </div>
  );
}

export function getFilterStyle(edit: StudioEdit | undefined): React.CSSProperties {
  if (!edit) return {};
  return { filter: getFilterCss(edit) };
}
