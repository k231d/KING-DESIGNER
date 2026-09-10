import { useState } from 'react';
import { Home, Users, MessageSquare, Bell, User, Moon, Sun, Search, Shield, Briefcase, Globe, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLang } from '@/contexts/LanguageContext';
import { Avatar } from '@/components/Avatar';
import { getDisplayName, getNameColor } from '@/lib/helpers';

export type Page = 'home' | 'friends' | 'messages' | 'notifications' | 'profile' | 'admin' | 'search' | 'service-requests' | 'verification' | 'post-detail' | 'settings';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page, params?: Record<string, string>) => void;
  children: React.ReactNode;
  unreadNotifications: number;
  unreadMessages: number;
  unreadFriends: number;
}

export function Layout({ currentPage, onNavigate, children, unreadNotifications, unreadMessages, unreadFriends }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, lang, toggleLang, isRTL } = useLang();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'home', label: t('home'), icon: <Home className="w-5 h-5" /> },
    { id: 'friends', label: t('friends'), icon: <Users className="w-5 h-5" />, badge: unreadFriends },
    { id: 'search', label: t('search'), icon: <Search className="w-5 h-5" /> },
    { id: 'messages', label: t('messages'), icon: <MessageSquare className="w-5 h-5" />, badge: unreadMessages },
    { id: 'notifications', label: t('notifications'), icon: <Bell className="w-5 h-5" />, badge: unreadNotifications },
  ];

  if (profile?.account_type === 'designer') {
    navItems.push({ id: 'service-requests', label: t('jobBoard'), icon: <Briefcase className="w-5 h-5" /> });
  }

  const nameColor = getNameColor(profile);

  return (
    <div className="min-h-screen bg-surface-light dark:bg-surface-dark flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col w-64 fixed top-0 bottom-0 border-${isRTL ? 'l' : 'r'} border-king-100 dark:border-surface-dark-border bg-white dark:bg-surface-dark-alt p-4 z-30 ${isRTL ? 'right-0' : 'left-0'}`}>
        <div className="flex items-center justify-center mb-8 px-2">
          <img src="/logo.png" alt="King Design" className="w-full max-w-[190px] h-16 object-contain" />
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${currentPage === item.id ? 'nav-item-active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge ? (
                <span className="ml-auto bg-king-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </div>
          ))}

          <div
            className={`nav-item ${currentPage === 'profile' ? 'nav-item-active' : ''}`}
            onClick={() => onNavigate('profile', { userId: profile?.id || '' })}
          >
            <User className="w-5 h-5" />
            <span>{t('profile')}</span>
          </div>

          <div
            className={`nav-item ${currentPage === 'verification' ? 'nav-item-active' : ''}`}
            onClick={() => onNavigate('verification')}
          >
            <Shield className="w-5 h-5" />
            <span>{t('verification')}</span>
          </div>

          {profile?.is_admin && (
            <div
              className={`nav-item ${currentPage === 'admin' ? 'nav-item-active' : ''}`}
              onClick={() => onNavigate('admin')}
            >
              <Shield className="w-5 h-5" />
              <span>{t('admin')}</span>
            </div>
          )}
          <div
            className={`nav-item ${currentPage === 'settings' ? 'nav-item-active' : ''}`}
            onClick={() => onNavigate('settings')}
          >
            <Settings className="w-5 h-5" />
            <span>الإعدادات</span>
          </div>
        </nav>

        <div className="flex flex-col gap-2 pt-4 border-t border-king-100 dark:border-surface-dark-border">
          <div className="flex items-center gap-2 px-2">
            <Avatar user={profile} size="sm" showVerified showAdmin />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={nameColor ? { color: nameColor } : undefined}>
                {getDisplayName(profile)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('id')}: {profile?.king_id}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={toggleLang} className="btn-ghost flex-1 flex items-center justify-center gap-1" title={t('language')}>
              <Globe className="w-4 h-4" />
              <span className="text-xs">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>
            <button onClick={toggleTheme} className="btn-ghost flex-1 flex items-center justify-center">
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button onClick={signOut} className="btn-ghost flex-1 text-xs">
              {t('signOut')}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-king-100 dark:border-surface-dark-border">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                currentPage === item.id ? 'text-king-500' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {item.icon}
              {item.badge ? (
                <span className="absolute top-0 right-0 bg-king-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile Top Bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 glass border-b border-king-100 dark:border-surface-dark-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center" onClick={() => onNavigate('home')}>
          <img src="/logo.png" alt="King Design" className="w-32 h-10 object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleLang} className="p-2 text-gray-600 dark:text-gray-400" title={t('language')}>
            <span className="text-xs font-medium">{lang === 'ar' ? 'EN' : 'ع'}</span>
          </button>
          <button onClick={toggleTheme} className="p-2 text-gray-600 dark:text-gray-400">
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <Avatar user={profile} size="sm" showVerified showAdmin onClick={() => onNavigate('profile', { userId: profile?.id || '' })} />
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 ${isRTL ? 'md:mr-64' : 'md:ml-64'} pt-16 md:pt-0 pb-20 md:pb-0 min-h-screen`}>
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
