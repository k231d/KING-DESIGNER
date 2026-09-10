import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { translations, type Lang, type TranslationKey } from '@/lib/translations';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('king-lang');
    if (stored === 'ar' || stored === 'en') return stored;
    return 'ar';
  });

  const isRTL = lang === 'ar';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    localStorage.setItem('king-lang', lang);
  }, [lang, isRTL]);

  const setLang = (l: Lang) => setLangState(l);
  const toggleLang = () => setLangState((l) => (l === 'ar' ? 'en' : 'ar'));

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
