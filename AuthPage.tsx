import { useState } from 'react';
import { Mail, Lock, Palette, ShoppingBag, ArrowRight, Globe, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';

interface AuthPageProps {
  mode?: 'recovery';
}

export function AuthPage({ mode: propMode }: AuthPageProps) {
  const { signIn, signUp, sendResetLink, updatePassword, clearRecovery } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [accountType, setAccountType] = useState<'client' | 'designer'>('client');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  // Recovery mode: user clicked the email link and returned to the app
  if (propMode === 'recovery') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-king-50 via-white to-king-100 dark:from-surface-dark dark:via-surface-dark-alt dark:to-surface-dark flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex justify-end mb-4">
            <button onClick={toggleLang} className="btn-ghost flex items-center gap-1.5 text-sm">
              <Globe className="w-4 h-4" />
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>

          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-3">
              <img src="/logo.png" alt="King Design" className="w-64 h-32 object-contain" />
            </div>
          </div>

          <div className="card p-6 animate-slide-up">
            {passwordUpdated ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 text-success-500 mx-auto" />
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('passwordUpdated')}</p>
                <button
                  onClick={() => { clearRecovery(); setNewPassword(''); }}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('backToLogin')}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="w-5 h-5 text-king-500" />
                  <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('newPassword')}</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('resetPasswordInstructions')}</p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError(null);
                    if (newPassword.length < 6) { setError(t('password')); return; }
                    setLoading(true);
                    const { error } = await updatePassword(newPassword);
                    if (error) setError(error);
                    else setPasswordUpdated(true);
                    setLoading(false);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('newPassword')}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-error-50 dark:bg-error-700/20 border border-error-200 dark:border-error-700/40 text-error-600 dark:text-error-400 text-sm rounded-xl px-4 py-3">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {t('verifyAndUpdate')}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'forgot') {
      const { error } = await sendResetLink(email);
      if (error) {
        setError(error);
      } else {
        setResetSent(true);
      }
      setLoading(false);
      return;
    }

    if (mode === 'signup') {
      const { error } = await signUp(email, password, accountType);
      if (error) setError(error);
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    }
    setLoading(false);
  };

  if (mode === 'forgot') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-king-50 via-white to-king-100 dark:from-surface-dark dark:via-surface-dark-alt dark:to-surface-dark flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex justify-end mb-4">
            <button onClick={toggleLang} className="btn-ghost flex items-center gap-1.5 text-sm">
              <Globe className="w-4 h-4" />
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>

          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-3">
              <img src="/logo.png" alt="King Design" className="w-64 h-32 object-contain" />
            </div>
          </div>

          <div className="card p-6 animate-slide-up">
            {resetSent ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 text-success-500 mx-auto" />
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('resetLinkSent')}</p>
                <button onClick={() => { setMode('login'); setResetSent(false); setEmail(''); }} className="btn-primary w-full flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  {t('backToLogin')}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="w-5 h-5 text-king-500" />
                  <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('resetPassword')}</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('resetPasswordInstructions')}</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('email')}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-error-50 dark:bg-error-700/20 border border-error-200 dark:border-error-700/40 text-error-600 dark:text-error-400 text-sm rounded-xl px-4 py-3">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {t('sendResetLink')}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <button onClick={() => setMode('login')} className="mt-4 text-sm text-king-500 hover:text-king-600 flex items-center gap-1.5 mx-auto">
                  <ArrowLeft className="w-4 h-4" />
                  {t('backToLogin')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-king-50 via-white to-king-100 dark:from-surface-dark dark:via-surface-dark-alt dark:to-surface-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Language Toggle */}
        <div className="flex justify-end mb-4">
          <button onClick={toggleLang} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Globe className="w-4 h-4" />
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-3">
            <img src="/logo.png" alt="King Design" className="w-64 h-32 object-contain" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('whereDesignersUnite')}</p>
        </div>

        <div className="card p-6 animate-slide-up">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-6 bg-king-50 dark:bg-surface-dark-alt rounded-xl p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-white dark:bg-surface-dark-card shadow-sm text-king-600 dark:text-king-400' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {t('signIn')}
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-white dark:bg-surface-dark-card shadow-sm text-king-600 dark:text-king-400' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {t('signUp')}
            </button>
          </div>

          {mode === 'signup' && (
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('accountType')}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType('client')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    accountType === 'client'
                      ? 'border-king-400 bg-king-50 dark:bg-surface-dark-card'
                      : 'border-king-100 dark:border-surface-dark-border hover:border-king-200'
                  }`}
                >
                  <ShoppingBag className={`w-7 h-7 ${accountType === 'client' ? 'text-king-500' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${accountType === 'client' ? 'text-king-600 dark:text-king-400' : 'text-gray-500 dark:text-gray-400'}`}>{t('client')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('designer')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    accountType === 'designer'
                      ? 'border-king-400 bg-king-50 dark:bg-surface-dark-card'
                      : 'border-king-100 dark:border-surface-dark-border hover:border-king-200'
                  }`}
                >
                  <Palette className={`w-7 h-7 ${accountType === 'designer' ? 'text-king-500' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${accountType === 'designer' ? 'text-king-600 dark:text-king-400' : 'text-gray-500 dark:text-gray-400'}`}>{t('designer')}</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="input-field pl-10"
                />
              </div>
            </div>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(null); }}
                className="text-sm text-king-500 hover:text-king-600 transition-colors"
              >
                {t('forgotPassword')}
              </button>
            )}

            {error && (
              <div className="bg-error-50 dark:bg-error-700/20 border border-error-200 dark:border-error-700/40 text-error-600 dark:text-error-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? t('signIn') : t('createAccount')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
