import { useState, useRef, useEffect } from 'react';
import { FileText, Play, Pause, Volume2, VolumeX, Download, X, ChevronLeft, ChevronRight, Grid3x3, LayoutList, Maximize2 } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/lib/translations';
import type { MediaItem } from '@/types';
import { getFilterStyle, type StudioEdit } from '@/components/MediaStudio';

const LOGO_PNG = '/لوجو_الكينج_.png';
const LOGO_GIF = '/_الكينج_.gif';

export interface MediaItemWithEdit extends MediaItem {
  edit?: StudioEdit;
}

interface MediaPreviewProps {
  media: MediaItem[] | MediaItemWithEdit[];
  className?: string;
  maxDisplay?: number;
  viewMode?: 'grid' | 'carousel' | 'list' | 'single';
  onViewModeChange?: (mode: 'grid' | 'carousel' | 'list' | 'single') => void;
  showViewToggle?: boolean;
  autoPlayVideo?: boolean;
  onMediaEnd?: () => void;
}

type ViewMode = 'grid' | 'carousel' | 'list' | 'single';

export function MediaPreview({
  media,
  className = '',
  maxDisplay = 4,
  viewMode: externalViewMode,
  onViewModeChange,
  showViewToggle = false,
  autoPlayVideo = false,
  onMediaEnd,
}: MediaPreviewProps) {
  const [muted, setMuted] = useState(autoPlayVideo);
  const { t } = useLang();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('grid');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const viewMode = externalViewMode || internalViewMode;
  const setViewMode = (m: ViewMode) => {
    if (onViewModeChange) onViewModeChange(m);
    else setInternalViewMode(m);
  };

  const items = (Array.isArray(media) ? media : []) as MediaItemWithEdit[];
  if (items.length === 0) return null;
  const display = items.slice(0, maxDisplay);
  const remaining = items.length - maxDisplay;

  const toggleAudio = (url: string) => {
    const audio = audioRefs.current[url];
    if (!audio) return;
    if (playing === url) {
      audio.pause();
      setPlaying(null);
    } else {
      Object.values(audioRefs.current).forEach((a) => a.pause());
      audio.play();
      setPlaying(url);
    }
  };

  const DownloadButton = ({ item }: { item: MediaItem }) => (
    <a
      href={item.url}
      download={item.name || 'download'}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute top-1 right-1 z-20 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-lg transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      <Download className="w-3.5 h-3.5" />
    </a>
  );

  const renderItem = (item: MediaItemWithEdit, index: number, fullSize = false) => {
    const key = `${item.url}-${index}`;
    const filterStyle = getFilterStyle(item.edit);
    const containerClass = fullSize
      ? 'w-full h-auto'
      : 'w-full h-full';

    if (item.type === 'image' || item.type === 'gif') {
      return (
        <div key={key} className="relative w-full h-full">
          <img
            src={item.url}
            alt={item.name || 'media'}
            className={`${containerClass} ${fullSize ? '' : 'object-cover'} cursor-pointer hover:opacity-90 transition-opacity`}
            style={filterStyle}
            onClick={() => setLightbox(index)}
          />
          <DownloadButton item={item} />
        </div>
      );
    }

    if (item.type === 'video') {
      return (
        <div key={key} className="relative w-full h-full">
          <video
            src={item.url}
            controls={!autoPlayVideo}
            autoPlay={autoPlayVideo}
            muted={muted}
            playsInline
            onEnded={onMediaEnd}
            className={`${containerClass} ${fullSize ? '' : 'object-cover'}`}
            style={filterStyle}
          />
          {autoPlayVideo && (
            <button
              onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
              className="absolute top-2 right-2 z-20 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}
          <DownloadButton item={item} />
        </div>
      );
    }

    if (item.type === 'audio') {
      return (
        <div key={key} className="w-full h-full flex flex-col items-center justify-center gap-2 bg-king-50 dark:bg-surface-dark-alt rounded-xl p-3">
          <Volume2 className="w-6 h-6 text-king-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-full">{item.name || 'Audio'}</span>
          <button
            onClick={() => toggleAudio(item.url)}
            className="flex items-center gap-1 text-king-600 dark:text-king-400 text-sm font-medium"
          >
            {playing === item.url ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {playing === item.url ? t('pause') : t('play')}
          </button>
          <audio ref={(el) => { if (el) audioRefs.current[item.url] = el; }} src={item.url} onEnded={() => setPlaying(null)} />
        </div>
      );
    }

    if (item.type === 'pdf') {
      return (
        <div key={key} className="relative w-full h-full flex flex-col items-center justify-center gap-2 bg-king-50 dark:bg-surface-dark-alt rounded-xl p-3 cursor-pointer" onClick={() => setLightbox(index)}>
          <FileText className="w-8 h-8 text-king-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-full">{item.name || 'PDF'}</span>
          <DownloadButton item={item} />
        </div>
      );
    }

    return (
      <a key={key} href={item.url} download={item.name} target="_blank" rel="noopener noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-2 bg-king-50 dark:bg-surface-dark-alt rounded-xl p-3">
        <Download className="w-6 h-6 text-king-500" />
        <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-full">{item.name || 'File'}</span>
      </a>
    );
  };

  const ViewToggle = () => {
    if (!showViewToggle || items.length <= 1) return null;
    return (
      <div className="flex items-center gap-1 mb-2">
        {([
          { mode: 'grid' as const, icon: Grid3x3, label: t('gridView') },
          { mode: 'carousel' as const, icon: Maximize2, label: t('carouselView') },
          { mode: 'list' as const, icon: LayoutList, label: t('listView') },
        ]).map((v) => (
          <button
            key={v.mode}
            onClick={() => setViewMode(v.mode)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
              viewMode === v.mode
                ? 'bg-king-100 text-king-600 dark:bg-surface-dark-alt dark:text-king-400'
                : 'text-gray-400 hover:text-king-500'
            }`}
            title={v.label}
          >
            <v.icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
    );
  };

  // Single item - always show at natural size
  if (items.length === 1) {
    const item = items[0];
    return (
      <>
        <ViewToggle />
        <div className={`rounded-xl overflow-hidden bg-gray-50 dark:bg-surface-dark-alt ${className}`}>
          {renderItem(item, 0, true)}
        </div>
        {lightbox !== null && (
          <Lightbox items={items} index={lightbox} onClose={() => setLightbox(null)} setIndex={setLightbox} t={t} audioRefs={audioRefs} playing={playing} toggleAudio={toggleAudio} />
        )}
      </>
    );
  }

  // Carousel view
  if (viewMode === 'carousel') {
    return (
      <>
        <ViewToggle />
        <div className={`relative rounded-xl overflow-hidden ${className}`}>
          <div className="relative w-full aspect-video bg-gray-50 dark:bg-surface-dark-alt">
            {renderItem(items[carouselIndex], carouselIndex, false)}
          </div>
          {items.length > 1 && (
            <>
              <button
                onClick={() => setCarouselIndex((i) => (i - 1 + items.length) % items.length)}
                className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCarouselIndex((i) => (i + 1) % items.length)}
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {items.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === carouselIndex ? 'bg-king-500' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        {lightbox !== null && (
          <Lightbox items={items} index={lightbox} onClose={() => setLightbox(null)} setIndex={setLightbox} t={t} audioRefs={audioRefs} playing={playing} toggleAudio={toggleAudio} />
        )}
      </>
    );
  }

  // List view - each item at natural size, stacked
  if (viewMode === 'list') {
    return (
      <>
        <ViewToggle />
        <div className={`space-y-2 ${className}`}>
          {items.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-gray-50 dark:bg-surface-dark-alt">
              {renderItem(item, i, true)}
            </div>
          ))}
        </div>
        {lightbox !== null && (
          <Lightbox items={items} index={lightbox} onClose={() => setLightbox(null)} setIndex={setLightbox} t={t} audioRefs={audioRefs} playing={playing} toggleAudio={toggleAudio} />
        )}
      </>
    );
  }

  // Grid view (default)
  const gridClass = display.length === 1
    ? 'grid-cols-1'
    : display.length === 2
    ? 'grid-cols-2'
    : display.length === 3
    ? 'grid-cols-2'
    : 'grid-cols-2';

  return (
    <>
      <ViewToggle />
      <div className={`grid ${gridClass} gap-1.5 rounded-xl overflow-hidden ${className}`}>
        {display.map((item, i) => (
          <div
            key={i}
            className={`relative ${display.length === 1 ? 'aspect-video' : 'aspect-square'} ${display.length === 3 && i === 0 ? 'col-span-2 aspect-video' : ''}`}
          >
            {renderItem(item, i)}
            {i === maxDisplay - 1 && remaining > 0 && (
              <div
                className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-lg cursor-pointer"
                onClick={() => setLightbox(i)}
              >
                +{remaining}
              </div>
            )}
          </div>
        ))}
      </div>
      {lightbox !== null && (
        <Lightbox items={items} index={lightbox} onClose={() => setLightbox(null)} setIndex={setLightbox} t={t} audioRefs={audioRefs} playing={playing} toggleAudio={toggleAudio} />
      )}
    </>
  );
}

function Lightbox({
  items,
  index,
  onClose,
  setIndex,
  t,
  audioRefs,
  playing,
  toggleAudio,
}: {
  items: MediaItemWithEdit[];
  index: number;
  onClose: () => void;
  setIndex: (i: number) => void;
  t: (key: TranslationKey) => string;
  audioRefs: React.MutableRefObject<Record<string, HTMLAudioElement>>;
  playing: string | null;
  toggleAudio: (url: string) => void;
}) {
  const item = items[index];
  const filterStyle = getFilterStyle(item.edit);

  const next = (e: React.MouseEvent) => { e.stopPropagation(); if (index < items.length - 1) setIndex(index + 1); };
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); if (index > 0) setIndex(index - 1); };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full z-10" onClick={onClose}>
        <X className="w-6 h-6" />
      </button>
      <a
        href={item.url}
        download={item.name || 'download'}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 left-4 text-white p-2 hover:bg-white/10 rounded-full z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <Download className="w-6 h-6" />
      </a>

      {items.length > 1 && (
        <>
          <button onClick={prev} disabled={index === 0} className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full z-10 disabled:opacity-30" >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={next} disabled={index === items.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full z-10 disabled:opacity-30">
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {item.type === 'image' || item.type === 'gif' ? (
        <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
          <img src={item.url} alt={item.name || 'media'} className="max-w-full max-h-[90vh] object-contain" style={filterStyle} />
          <img src={LOGO_PNG} alt="watermark" className="absolute bottom-2 left-2 w-[200px] h-[200px] object-contain opacity-30 mix-blend-multiply dark:mix-blend-screen pointer-events-none" />
        </div>
      ) : item.type === 'video' ? (
        <div className="relative max-w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
          <video src={item.url} controls autoPlay className="max-w-full max-h-[90vh]" style={filterStyle} />
          <img src={LOGO_GIF} alt="watermark" className="absolute bottom-2 left-2 w-[200px] h-[200px] object-contain opacity-30 mix-blend-multiply dark:mix-blend-screen pointer-events-none" />
        </div>
      ) : item.type === 'pdf' ? (
        <div className="relative w-full h-[90vh]" onClick={(e) => e.stopPropagation()}>
          <iframe src={item.url} className="w-full h-full bg-white" title={item.name || 'PDF'} />
          <img src={LOGO_PNG} alt="watermark" className="absolute bottom-2 left-2 w-[200px] h-[200px] object-contain opacity-20 pointer-events-none" />
        </div>
      ) : item.type === 'audio' ? (
        <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
          <Volume2 className="w-16 h-16 text-king-400" />
          <audio src={item.url} controls autoPlay />
        </div>
      ) : (
        <a href={item.url} download={item.name} className="text-king-400 underline">{t('download')} {item.name}</a>
      )}
    </div>
  );
}
