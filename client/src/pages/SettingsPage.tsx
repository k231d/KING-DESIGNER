import { useState } from 'react';
import { Lock, Mail, Shield, Image, Save, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function SettingsPage({ onNavigate }: { onNavigate: (page: string, params?: Record<string, string>) => void }) {
  const { profile, refreshProfile } = useAuth();
  const [email, setEmail] = useState(profile?.email || '');
  const [password, setPassword] = useState('');
  const [hidePortfolio, setHidePortfolio] = useState(localStorage.getItem('portfolio_private') === 'true');
  const [hideActivity, setHideActivity] = useState(localStorage.getItem('activity_private') === 'true');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const saveAccount = async () => {
    setSaving(true);
    setMessage('');
    const updates: { email?: string; password?: string } = {};
    if (email.trim() && email.trim() !== profile?.email) updates.email = email.trim();
    if (password.trim()) updates.password = password;
    const { error } = Object.keys(updates).length ? await supabase.auth.updateUser(updates) : { error: null };
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setPassword('');
    await refreshProfile();
    setMessage('تم حفظ إعدادات الحساب. قد يطلب تغيير البريد تأكيدًا عبر البريد الإلكتروني.');
  };

  const savePrivacy = () => {
    localStorage.setItem('portfolio_private', String(hidePortfolio));
    localStorage.setItem('activity_private', String(hideActivity));
    setMessage('تم حفظ إعدادات الخصوصية.');
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div><h1 className="font-display font-bold text-2xl text-gray-900 dark:text-king-50">الإعدادات</h1><p className="text-sm text-gray-500 mt-1">إدارة الحساب والخصوصية والمعرض</p></div>
      <section className="card p-5 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-king-500" /> الحساب</h2>
        <label className="block text-sm"><span className="text-gray-500 block mb-1">البريد الإلكتروني</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" /></label>
        <label className="block text-sm"><span className="text-gray-500 block mb-1">كلمة مرور جديدة</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="اتركها فارغة دون تغيير" className="input-field" /></label>
        <button onClick={saveAccount} disabled={saving} className="btn-primary flex items-center gap-2"><KeyRound className="w-4 h-4" />{saving ? 'جاري الحفظ...' : 'حفظ الحساب'}</button>
      </section>
      <section className="card p-5 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-king-500" /> الخصوصية</h2>
        <label className="flex items-center justify-between gap-3 text-sm"><span>حماية معرض الأعمال وجعله خاصًا</span><input type="checkbox" checked={hidePortfolio} onChange={(e) => setHidePortfolio(e.target.checked)} className="w-5 h-5 accent-king-500" /></label>
        <label className="flex items-center justify-between gap-3 text-sm"><span>إخفاء نشاطي عن الاقتراحات</span><input type="checkbox" checked={hideActivity} onChange={(e) => setHideActivity(e.target.checked)} className="w-5 h-5 accent-king-500" /></label>
        <button onClick={savePrivacy} className="btn-secondary flex items-center gap-2"><Save className="w-4 h-4" />حفظ الخصوصية</button>
      </section>
      <section className="card p-5">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-king-500" /> إدارة المعرض</h2>
        <p className="text-sm text-gray-500 mb-3">انتقل إلى ملفك لإضافة المجلدات وإدارة محتوى معرض الأعمال.</p>
        <button onClick={() => onNavigate('profile', { userId: profile?.id || '' })} className="btn-primary">فتح ملفي وإدارة المعرض</button>
      </section>
      {message && <div className="card p-3 text-sm text-king-600 dark:text-king-300">{message}</div>}
    </div>
  );
}
export default SettingsPage;
