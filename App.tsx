import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider, useLang } from '@/contexts/LanguageContext';
import { Layout, type Page } from '@/components/Layout';
import { AuthPage } from '@/pages/AuthPage';
import { HomePage } from '@/pages/HomePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { MessagesPage } from '@/pages/MessagesPage';
import { FriendsPage } from '@/pages/FriendsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { SearchPage } from '@/pages/SearchPage';
import { ServiceRequestsPage } from '@/pages/ServiceRequestsPage';
import { VerificationPage } from '@/pages/VerificationPage';
import { AdminPage } from '@/pages/AdminPage';
import { PostDetailPage } from '@/pages/PostDetailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { supabase } from '@/lib/supabase';
import type { SplashScreen } from '@/types';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';

function AppContent() {
  const { session, profile, loading, isRecoverySession } = useAuth();
  const { t } = useLang();
  useBrowserNotifications();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [pageParams, setPageParams] = useState<Record<string, string>>({});
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadFriends, setUnreadFriends] = useState(0);
  const [splash, setSplash] = useState<SplashScreen | null>(null);
  const [splashSeconds, setSplashSeconds] = useState(5);
  const [introVisible, setIntroVisible] = useState(false);
  const [introSeconds, setIntroSeconds] = useState(5);

  useEffect(() => {
    const kingId = new URLSearchParams(window.location.search).get('profile');
    if (!kingId || !profile) return;
    const numericId = Number(kingId);
    if (!Number.isFinite(numericId)) return;
    supabase.from('profiles').select('id').eq('king_id', numericId).maybeSingle().then(({ data }) => {
      if (data?.id) {
        setCurrentPage('profile');
        setPageParams({ userId: data.id });
      }
    });
  }, [profile]);

  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get('post_id');
    if (postId && profile) {
      setCurrentPage('post-detail');
      setPageParams({ postId });
    }
  }, [profile]);

  useEffect(() => {
    supabase.from('splash_screens').select('*').eq('enabled', true).order('display_order').limit(3).then(({ data }) => {
      const screens = Array.isArray(data) ? data as SplashScreen[] : [];
      if (screens.length > 0) {
        setSplash(screens[Math.floor(Math.random() * screens.length)]);
        setSplashSeconds(screens[0].duration_seconds || screens[0].duration || 5);
      }
    });
  }, []);

  useEffect(() => {
    if (!splash) return;
    const timer = setInterval(() => setSplashSeconds((seconds) => {
      if (seconds <= 1) {
        setSplash(null);
        return 0;
      }
      return seconds - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [splash]);

  useEffect(() => {
    if (!profile?.intro_video_url || profile.intro_video_enabled === false || (profile.intro_video_expires_at && new Date(profile.intro_video_expires_at) <= new Date())) return;
    const key = `king-intro-${profile.id}-${profile.intro_video_url}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, 'shown');
    setIntroSeconds(profile.intro_video_duration_seconds || 5);
    setIntroVisible(true);
    const timer = window.setTimeout(() => setIntroVisible(false), (profile.intro_video_duration_seconds || 5) * 1000);
    return () => window.clearTimeout(timer);
  }, [profile]);

  useEffect(() => {
    if (!introVisible) return;
    const timer = window.setInterval(() => setIntroSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [introVisible]);

  const handleNavigate = (page: string, params?: Record<string, string>) => {
    setCurrentPage(page as Page);
    setPageParams(params || {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!profile) return;

    const fetchUnread = async () => {
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
        .neq('type', 'message');
      setUnreadNotifications(notifCount || 0);

      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', profile.id)
        .neq('status', 'seen');
      setUnreadMessages(msgCount || 0);
      const { count: friendCount } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', profile.id)
        .eq('status', 'pending');
      setUnreadFriends(friendCount || 0);
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-light dark:bg-surface-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-king-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-king-500 font-display">King Design</p>
        </div>
      </div>
    );
  }

  if (isRecoverySession) {
    return <AuthPage mode="recovery" />;
  }

  if (!session || !profile) {
    return <AuthPage />;
  }

  // Check ban status
  if (profile.is_banned && profile.ban_type === 'permanent') {
    return (
      <div className="min-h-screen bg-surface-light dark:bg-surface-dark flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-md">
          <h2 className="font-display font-bold text-xl text-error-500 mb-2">{t('banned')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('accountPermanentlyBanned')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {introVisible && profile?.intro_video_url && (
        <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center" onClick={() => setIntroVisible(false)}>
          <video src={profile.intro_video_url} autoPlay muted playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button onClick={(e) => { e.stopPropagation(); setIntroVisible(false); }} className="text-white/80 bg-black/40 backdrop-blur-md rounded-full px-5 py-2 text-sm">تخطي الدخولية ({introSeconds})</button>
          </div>
        </div>
      )}
      {splash && (
        <div
          className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in cursor-pointer"
          onClick={() => setSplash(null)}
        >
          {splash.media_type === 'video' ? <video src={splash.image_url} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" /> : <img src={splash.image_url} alt={splash.title} className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
          <div className="relative z-10 text-center px-6 max-w-lg">
            {splash.title && <h1 className="font-display font-bold text-2xl md:text-3xl text-white mb-2 drop-shadow-lg">{splash.title}</h1>}
            {splash.subtitle && <p className="text-white/80 text-sm md:text-base drop-shadow-md">{splash.subtitle}</p>}
          </div>
          <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-3 z-10">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <span className="text-white font-display font-bold text-lg">{splashSeconds}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setSplash(null); }}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm bg-white/10 backdrop-blur-md rounded-full px-4 py-2 transition-colors"
            >
              <X className="w-4 h-4" /> {t('skip')}
            </button>
          </div>
        </div>
      )}
      <Layout
        currentPage={currentPage}
        onNavigate={handleNavigate}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
        unreadFriends={unreadFriends}
      >
        {currentPage === 'home' && <HomePage onNavigate={handleNavigate} />}
        {currentPage === 'profile' && <ProfilePage userId={pageParams.userId} onNavigate={handleNavigate} />}
        {currentPage === 'messages' && <MessagesPage targetUserId={pageParams.userId} onNavigate={handleNavigate} />}
        {currentPage === 'friends' && <FriendsPage onNavigate={handleNavigate} />}
        {currentPage === 'notifications' && <NotificationsPage onNavigate={handleNavigate} />}
        {currentPage === 'search' && <SearchPage onNavigate={handleNavigate} />}
        {currentPage === 'service-requests' && <ServiceRequestsPage onNavigate={handleNavigate} />}
        {currentPage === 'verification' && <VerificationPage />}
        {currentPage === 'admin' && <AdminPage onNavigate={handleNavigate} />}
        {currentPage === 'post-detail' && <PostDetailPage postId={pageParams.postId} onNavigate={handleNavigate} />}
        {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
      </Layout>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
