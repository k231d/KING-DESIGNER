import { useState, useEffect, useCallback } from 'react';
import { Shield, Upload, FileText, Check, X, AlertCircle } from 'lucide-react';
import { supabase, STORAGE_BUCKETS } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import type { Verification } from '@/types';

export function VerificationPage() {
  const { profile } = useAuth();
  const { t } = useLang();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [idFront, setIdFront] = useState<string | null>(null);
  const [idBack, setIdBack] = useState<string | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchVerification = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('verifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setVerification(data as Verification | null);
  }, [profile]);

  useEffect(() => {
    fetchVerification().finally(() => setLoading(false));
  }, [fetchVerification]);

  const uploadFile = async (file: File, type: 'id_front' | 'id_back' | 'cv'): Promise<string | null> => {
    if (!profile) return null;
    const path = `${profile.id}/${type}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.VERIFICATIONS).upload(path, file);
    if (error) return null;
    const result = await supabase.storage.from(STORAGE_BUCKETS.VERIFICATIONS).createSignedUrl(path, 3600);
    return result.data?.signedUrl || path;
  };

  const handleSubmit = async () => {
    if (!profile || !idFront || !idBack || !cvUrl) return;
    setSubmitting(true);
    await supabase.from('verifications').insert({
      user_id: profile.id,
      id_card_front_url: idFront,
      id_card_back_url: idBack,
      cv_url: cvUrl,
    });
    setSubmitting(false);
    setIdFront(null);
    setIdBack(null);
    setCvUrl(null);
    fetchVerification();
  };

  if (loading) {
    return <div className="card p-8 shimmer-bg h-64" />;
  }

  if (profile?.is_verified) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-success-100 dark:bg-success-700/30 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check className="w-8 h-8 text-success-500" />
        </div>
        <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50 mb-1">{t('verifiedAccount')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('yourIdentityVerified')}</p>
      </div>
    );
  }

  if (verification && verification.status === 'pending') {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-king-100 dark:bg-surface-dark-alt rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-8 h-8 text-king-500" />
        </div>
        <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50 mb-1">{t('underReview')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('verificationPending')}</p>
      </div>
    );
  }

  if (verification && verification.status === 'rejected') {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-error-100 dark:bg-error-700/30 rounded-full flex items-center justify-center mx-auto mb-3">
          <X className="w-8 h-8 text-error-500" />
        </div>
        <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50 mb-1">{t('verificationRejectedTitle')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{verification.admin_note || t('verificationRejectedMsg')}</p>
        <p className="text-xs text-gray-400">{t('submitNewRequest')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-king-50 flex items-center gap-2">
          <Shield className="w-6 h-6 text-king-500" /> {t('identityVerification')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('uploadIdMessage')}
        </p>
      </div>

      <div className="card p-5 space-y-4">
        {/* ID Front */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('idFront')}</label>
          <label className="block border-2 border-dashed border-king-200 dark:border-surface-dark-border rounded-xl p-6 text-center cursor-pointer hover:border-king-400 transition-colors">
            {idFront ? (
              <div className="text-success-500 flex items-center justify-center gap-2"><Check className="w-5 h-5" /> {t('fileSelected')}</div>
            ) : (
              <div className="text-gray-400">
                <Upload className="w-6 h-6 mx-auto mb-1" />
                <span className="text-sm">{t('clickToUploadFront')}</span>
              </div>
            )}
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setIdFront(await uploadFile(file, 'id_front'));
            }} />
          </label>
        </div>

        {/* ID Back */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('idBack')}</label>
          <label className="block border-2 border-dashed border-king-200 dark:border-surface-dark-border rounded-xl p-6 text-center cursor-pointer hover:border-king-400 transition-colors">
            {idBack ? (
              <div className="text-success-500 flex items-center justify-center gap-2"><Check className="w-5 h-5" /> {t('fileSelected')}</div>
            ) : (
              <div className="text-gray-400">
                <Upload className="w-6 h-6 mx-auto mb-1" />
                <span className="text-sm">{t('clickToUploadBack')}</span>
              </div>
            )}
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setIdBack(await uploadFile(file, 'id_back'));
            }} />
          </label>
        </div>

        {/* CV */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('cvResume')}</label>
          <label className="block border-2 border-dashed border-king-200 dark:border-surface-dark-border rounded-xl p-6 text-center cursor-pointer hover:border-king-400 transition-colors">
            {cvUrl ? (
              <div className="text-success-500 flex items-center justify-center gap-2"><Check className="w-5 h-5" /> {t('fileSelected')}</div>
            ) : (
              <div className="text-gray-400">
                <FileText className="w-6 h-6 mx-auto mb-1" />
                <span className="text-sm">{t('clickToUploadCv')}</span>
              </div>
            )}
            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setCvUrl(await uploadFile(file, 'cv'));
            }} />
          </label>
        </div>

        <button onClick={handleSubmit} disabled={!idFront || !idBack || !cvUrl || submitting} className="btn-primary w-full">
          {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t('submitForVerification')}
        </button>
      </div>
    </div>
  );
}
