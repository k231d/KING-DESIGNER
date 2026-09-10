import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Send, Image as ImageIcon, DollarSign, Briefcase, Check, XCircle } from 'lucide-react';
import { supabase, STORAGE_BUCKETS } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import { Avatar } from '@/components/Avatar';
import { MediaPreview } from '@/components/MediaPreview';
import { getDisplayName, formatTime, formatPrice, getFileType } from '@/lib/helpers';
import type { ServiceRequest, Profile, MediaItem } from '@/types';

const REJECT_REASONS_AR = ['لست متاحاً حالياً', 'السعر غير مناسب', 'لا يتوافق مع تخصصي', 'الموعد غير مناسب'];
const REJECT_REASONS_EN = ['Not available right now', 'Price not suitable', 'Outside my expertise', 'Schedule conflict'];

interface ServiceRequestsPageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function ServiceRequestsPage({ onNavigate }: ServiceRequestsPageProps) {
  const { profile } = useAuth();
  const { t, lang } = useLang();
  const [requests, setRequests] = useState<(ServiceRequest & { user: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [rejecting, setRejecting] = useState<ServiceRequest | null>(null);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('service_requests')
      .select('*, user:profiles!service_requests_user_id_fkey(*)')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (data) setRequests(data as (ServiceRequest & { user: Profile })[]);
  }, []);

  useEffect(() => {
    fetchRequests().finally(() => setLoading(false));
  }, [fetchRequests]);

  const handleAccept = async (req: ServiceRequest) => {
    if (!profile) return;
    await supabase.from('service_requests').update({
      status: 'taken',
      designer_id: profile.id,
      accepted_at: new Date().toISOString(),
    }).eq('id', req.id);

    await supabase.from('notifications').insert({
      user_id: req.user_id,
      actor_id: profile.id,
      type: 'service_accepted',
      entity_type: 'service_request',
      entity_id: req.id,
    });

    fetchRequests();
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card p-4 shimmer-bg h-24" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-king-50">{t('jobBoard')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('serviceRequests')}</p>
        </div>
        {profile?.account_type === 'client' && (
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> {t('postRequest')}
          </button>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          <Briefcase className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>{t('noOpenRequests')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar user={req.user} size="sm" showVerified showAdmin onClick={() => onNavigate('profile', { userId: req.user_id })} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{getDisplayName(req.user)}</p>
                  <p className="text-xs text-gray-500">{t('id')}: {req.user.king_id} · {formatTime(req.created_at)}</p>
                </div>
                {req.price > 0 && (
                  <span className="badge bg-king-100 dark:bg-surface-dark-alt text-king-600 dark:text-king-400">
                    <DollarSign className="w-3 h-3" /> {formatPrice(req.price, req.currency)}
                  </span>
                )}
              </div>
              <h3 className="font-medium text-gray-900 dark:text-king-50 mb-1">{req.title}</h3>
              {req.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{req.description}</p>}
              {req.media && req.media.length > 0 && <MediaPreview media={req.media} className="mb-2" />}
              <div className="flex gap-2 flex-wrap">
                {profile?.account_type === 'designer' && (
                  <>
                    <button onClick={() => handleAccept(req)} className="btn-primary text-sm flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> {t('acceptRequest')}
                    </button>
                    <button onClick={() => setRejecting(req)} className="btn-secondary text-sm flex items-center gap-1.5 text-error-600 dark:text-error-400">
                      <XCircle className="w-4 h-4" /> {t('rejectRequest')}
                    </button>
                  </>
                )}
                <button onClick={() => onNavigate('messages', { userId: req.user_id })} className="btn-ghost text-sm">
                  {t('contactClient')}
                </button>
                <button onClick={() => onNavigate('profile', { userId: req.user_id })} className="btn-ghost text-sm">
                  {t('viewProfile')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateRequestModal onClose={() => { setShowCreate(false); fetchRequests(); }} />}
      {rejecting && (
        <RejectModal
          request={rejecting}
          lang={lang}
          onClose={() => setRejecting(null)}
          onDone={() => { setRejecting(null); fetchRequests(); }}
        />
      )}
    </div>
  );
}

function RejectModal({ request, lang, onClose, onDone }: { request: ServiceRequest; lang: 'ar' | 'en'; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const reasons = lang === 'ar' ? REJECT_REASONS_AR : REJECT_REASONS_EN;
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const reason = otherReason.trim() || selectedReason;
    if (!reason) return;
    setSaving(true);
    await supabase.from('service_requests').update({
      status: 'closed',
      reject_reason: reason,
      rejected_at: new Date().toISOString(),
    }).eq('id', request.id);

    await supabase.from('notifications').insert({
      user_id: request.user_id,
      actor_id: null,
      type: 'service_rejected',
      entity_type: 'service_request',
      entity_id: request.id,
    });

    setSaving(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-md p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('rejectRequest')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="space-y-3">
          {reasons.map((r) => (
            <button
              key={r}
              onClick={() => { setSelectedReason(r); setOtherReason(''); }}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                selectedReason === r && !otherReason ? 'border-king-400 bg-king-50 dark:bg-surface-dark-card' : 'border-king-100 dark:border-surface-dark-border hover:border-king-200'
              }`}
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">{r}</span>
            </button>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('otherReason')}</label>
            <textarea value={otherReason} onChange={(e) => { setOtherReason(e.target.value); setSelectedReason(''); }} rows={2} className="input-field resize-none text-sm" />
          </div>
          <button onClick={handleSubmit} disabled={saving || (!selectedReason && !otherReason.trim())} className="btn-primary w-full">
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t('sendComplaint')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateRequestModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const { t } = useLang();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !profile) return;
    setUploading(true);
    const items: MediaItem[] = [];
    for (const file of Array.from(files)) {
      const path = `${profile.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.MEDIA).upload(path, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKETS.MEDIA).getPublicUrl(path);
        items.push({ type: getFileType(file.name), url: publicUrl, name: file.name, size: file.size });
      }
    }
    setMediaItems([...mediaItems, ...items]);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!profile || !title.trim()) return;
    await supabase.from('service_requests').insert({
      user_id: profile.id,
      title: title.trim(),
      description: description.trim(),
      media: mediaItems,
      price: price ? parseFloat(price) : 0,
      currency,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-lg p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('postRequest')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('requestTitle')} className="input-field" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('describeWhatYouNeed')} rows={3} className="input-field resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('budget')}</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('currency')}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
                <option>USD</option><option>EUR</option><option>GBP</option><option>SAR</option><option>EGP</option><option>AED</option>
              </select>
            </div>
          </div>

          {mediaItems.length > 0 && (
            <div>
              <MediaPreview media={mediaItems} />
              <button onClick={() => setMediaItems([])} className="text-xs text-error-500 mt-1">Remove all</button>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-king-500">
            <ImageIcon className="w-5 h-5" /> {t('addMedia')}
            <input type="file" multiple accept="image/*,video/*,audio/*,.pdf,.gif,.svga" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
          </label>

          <button onClick={handleSubmit} disabled={uploading || !title.trim()} className="btn-primary w-full flex items-center justify-center gap-2">
            {uploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> {t('postRequest')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
