import { useState, useEffect, useCallback } from 'react';
import { Camera, Copy, Check, MapPin, Calendar, Edit2, X, Star, Plus, Trash2, Briefcase, FileText, Award, Share2, Globe, ShoppingBag, LayoutGrid, Heart, Folder, Upload, MessageSquare, MessageCircle, ThumbsUp, ThumbsDown, ChevronLeft, Ban, Flag, ExternalLink, Phone, ShieldOff, Lock } from 'lucide-react';
import { supabase, STORAGE_BUCKETS } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import { Avatar } from '@/components/Avatar';
import { MediaPreview } from '@/components/MediaPreview';
import { getDisplayName, getNameColor, getNameStyle, shouldUseAnimatedName, getRankName, formatTime, formatLastSeen, copyToClipboard, getFileType } from '@/lib/helpers';
import type { Profile, Post, Rating, DesignerService, PortfolioSection, PortfolioFolder, MediaItem, ServiceRequest } from '@/types';
import type { TranslationKey } from '@/lib/translations';

interface ProfilePageProps {
  userId?: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const REJECT_REASONS_AR = ['لست متاحاً حالياً', 'السعر غير مناسب', 'لا يتوافق مع تخصصي', 'الموعد غير مناسب'];
const REJECT_REASONS_EN = ['Not available right now', 'Price not suitable', 'Outside my expertise', 'Schedule conflict'];

const safeMediaList = (value: unknown): MediaItem[] => Array.isArray(value) ? value as MediaItem[] : [];

export function ProfilePage({ userId, onNavigate }: ProfilePageProps) {
  const { profile: currentUser, refreshProfile } = useAuth();
  const { t, lang, toggleLang, isRTL } = useLang();
  const targetId = userId || currentUser?.id || '';
  const [user, setUser] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [services, setServices] = useState<DesignerService[]>([]);
  const [portfolioSections, setPortfolioSections] = useState<PortfolioSection[]>([]);
  const [portfolioFolders, setPortfolioFolders] = useState<PortfolioFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'portfolio' | 'services' | 'reviews' | 'about' | 'dashboard'>('posts');
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [folderRatings, setFolderRatings] = useState<Rating[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [favoriteDesigners, setFavoriteDesigners] = useState<Profile[]>([]);
  const [viewingFolder, setViewingFolder] = useState<PortfolioFolder | null>(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [viewingService, setViewingService] = useState<DesignerService | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<ServiceRequest | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockList, setShowBlockList] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Profile[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  const isOwn = targetId === currentUser?.id;
  const isClient = user?.account_type === 'client';
  const isDesigner = user?.account_type === 'designer';
  const isAdmin = user?.is_admin === true;

  const fetchProfile = useCallback(async () => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();
    setUser(profileData as Profile);

    const { data: postsData } = await supabase
      .from('posts')
      .select('*, user:profiles!posts_user_id_fkey(*), likes(user_id), comments(id)')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false });
    setPosts(Array.isArray(postsData) ? postsData as Post[] : []);

    const { data: ratingsData } = await supabase
      .from('ratings')
      .select('*, rater:profiles!ratings_rater_id_fkey(*)')
      .eq('rated_user_id', targetId)
      .order('created_at', { ascending: false });
    setRatings(Array.isArray(ratingsData) ? ratingsData as Rating[] : []);

    const { data: servicesData } = await supabase
      .from('designer_services')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false });
    setServices(Array.isArray(servicesData) ? servicesData as DesignerService[] : []);

    const { data: portfolioData } = await supabase
      .from('portfolio_sections')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false });
    setPortfolioSections(Array.isArray(portfolioData) ? portfolioData as PortfolioSection[] : []);

    const { data: foldersData } = await supabase
      .from('portfolio_folders')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false });
    setPortfolioFolders(Array.isArray(foldersData) ? foldersData as PortfolioFolder[] : []);

    if (currentUser && !isOwn) {
      const { data: friendship } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${currentUser.id},receiver_id.eq.${targetId}),and(receiver_id.eq.${currentUser.id},requester_id.eq.${targetId})`)
        .maybeSingle();
      if (friendship) {
        setIsFriend(friendship.status === 'accepted');
        setFriendRequestSent(friendship.status === 'pending');
      }

      const { data: block } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', targetId)
        .maybeSingle();
      setIsBlocked(!!block);
    }

    if ((profileData as Profile | null)?.account_type === 'client') {
      const { data: reqs } = await supabase
        .from('service_requests')
        .select('*, designer:profiles!service_requests_designer_id_fkey(*)')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false });
      setServiceRequests((reqs as ServiceRequest[]) || []);

      const { data: friends } = await supabase
        .from('friendships')
        .select('receiver:profiles!friendships_receiver_id_fkey(*), requester:profiles!friendships_requester_id_fkey(*)')
        .or(`requester_id.eq.${targetId},receiver_id.eq.${targetId}`)
        .eq('status', 'accepted');
      const designerFriends: Profile[] = [];
      for (const f of (friends as unknown as { receiver: Profile; requester: Profile }[]) || []) {
        const other = f.receiver.id === targetId ? f.requester : f.receiver;
        if (other.account_type === 'designer') designerFriends.push(other);
      }
      setFavoriteDesigners(designerFriends);
    }
  }, [targetId, currentUser, isOwn]);

  useEffect(() => {
    fetchProfile().finally(() => setLoading(false));
  }, [fetchProfile]);

  useEffect(() => {
    if (ratings.length < 2) return;
    const timer = window.setInterval(() => setReviewIndex((index) => (index + 1) % ratings.length), 3500);
    return () => window.clearInterval(timer);
  }, [ratings.length]);

  const handleCopyId = async () => {
    if (user) {
      await copyToClipboard(user.king_id.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    setShowShareModal(true);
  };

  const handleFriendRequest = async () => {
    if (!currentUser || !user) return;
    await supabase.from('friendships').insert({
      requester_id: currentUser.id,
      receiver_id: user.id,
      status: 'pending',
    });
    await supabase.from('notifications').insert({
      user_id: user.id,
      actor_id: currentUser.id,
      type: 'friend_request',
      entity_type: 'user',
      entity_id: currentUser.id,
    });
    setFriendRequestSent(true);
  };

  const handleMessage = () => {
    onNavigate('messages', { userId: targetId });
  };

  const handleBlock = async () => {
    if (!currentUser || !user) return;
    if (!confirm(t('blockConfirm'))) return;
    await supabase.from('blocked_users').insert({ blocker_id: currentUser.id, blocked_id: user.id });
    await supabase.from('friendships').delete()
      .or(`and(requester_id.eq.${currentUser.id},receiver_id.eq.${user.id}),and(receiver_id.eq.${currentUser.id},requester_id.eq.${user.id})`);
    setIsBlocked(true);
    setIsFriend(false);
    setFriendRequestSent(false);
  };

  const handleUnblock = async () => {
    if (!currentUser || !user) return;
    await supabase.from('blocked_users').delete().eq('blocker_id', currentUser.id).eq('blocked_id', user.id);
    setIsBlocked(false);
  };

  const fetchBlockedUsers = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('blocked_users')
      .select('blocked:profiles!blocked_users_blocked_id_fkey(*)')
      .eq('blocker_id', currentUser.id);
    if (data) setBlockedUsers(data.map((d) => d.blocked as unknown as Profile));
  };

  const handleUnblockUser = async (blockedId: string) => {
    if (!currentUser) return;
    await supabase.from('blocked_users').delete().eq('blocker_id', currentUser.id).eq('blocked_id', blockedId);
    fetchBlockedUsers();
  };

  // Update last_seen on mount
  useEffect(() => {
    if (currentUser) {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
      const interval = setInterval(() => {
        supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const handleImageUpload = async (kind: 'avatar' | 'cover') => {
    if (!currentUser) return;
    const file = kind === 'avatar' ? avatarFile : coverFile;
    if (!file) return;
    const bucket = kind === 'avatar' ? STORAGE_BUCKETS.AVATARS : STORAGE_BUCKETS.COVERS;
    const path = `${currentUser.id}/${kind}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) return;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    if (kind === 'avatar' && (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) && (currentUser.vip_level || 0) >= 3) {
      await supabase.from('profiles').update({ avatar_gif_url: publicUrl, avatar_url: publicUrl }).eq('id', currentUser.id);
    } else {
      await supabase.from('profiles').update({ [kind === 'avatar' ? 'avatar_url' : 'cover_url']: publicUrl }).eq('id', currentUser.id);
    }
    if (kind === 'avatar') {
      setAvatarPreview(null);
      setAvatarFile(null);
    } else {
      setCoverPreview(null);
      setCoverFile(null);
    }
    await refreshProfile();
    await fetchProfile();
  };

  const handleRateDesigner = async (score: number, comment: string) => {
    if (!currentUser || !user) return;
    const { error } = await supabase.from('ratings').insert({
      rater_id: currentUser.id,
      rated_user_id: user.id,
      score,
      comment: comment.trim(),
    });
    if (error) {
      window.alert(error.message);
      return;
    }
    await supabase.from('notifications').insert({
      user_id: user.id,
      actor_id: currentUser.id,
      type: 'rating',
      entity_type: 'rating',
      entity_id: user.id,
    });
    setShowRatingModal(false);
    fetchProfile();
  };

  const fetchFolderRatings = useCallback(async (folderOwnerId: string) => {
    const { data } = await supabase
      .from('ratings')
      .select('*, rater:profiles!ratings_rater_id_fkey(*)')
      .eq('rated_user_id', folderOwnerId)
      .order('created_at', { ascending: false });
    setFolderRatings(data as Rating[]);
  }, []);

  if (loading) {
    return <div className="card p-8 shimmer-bg h-96 rounded-2xl" />;
  }

  if (!user) {
    return <div className="card p-8 text-center text-gray-500">{t('loading')}</div>;
  }

  const nameColor = getNameColor(user);
  const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length : 0;

  // Build tabs based on account type. Admin-designers still get designer tabs.
  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'posts', label: t('posts') },
  ];
  if (isClient) {
    tabs.push({ id: 'dashboard', label: t('clientDashboard') });
  } else if (isDesigner) {
    tabs.push({ id: 'portfolio', label: t('portfolio') });
    tabs.push({ id: 'services', label: t('services') });
  }
  tabs.push({ id: 'reviews', label: t('reviews') });
  tabs.push({ id: 'about', label: t('about') });

  return (
    <div className="space-y-4">
      {/* Cover & Avatar */}
      <div className="card overflow-hidden">
        <div className="relative h-40 md:h-52 bg-gradient-to-br from-king-300 to-king-500">
          {(coverPreview || user.cover_url) && !user.photo_banned && (
            <img src={coverPreview || user.cover_url || ''} alt="cover" className="w-full h-full object-cover" />
          )}
          {isOwn && coverPreview && (
            <div className="absolute bottom-3 left-3 flex gap-2">
              <button onClick={() => handleImageUpload('cover')} className="bg-success-600 hover:bg-success-700 text-white rounded-lg px-3 py-1.5 text-xs">{t('saveChanges')}</button>
              <button onClick={() => { setCoverPreview(null); setCoverFile(null); }} className="bg-black/50 hover:bg-black/70 text-white rounded-lg px-3 py-1.5 text-xs">{t('cancel')}</button>
            </div>
          )}
          {isOwn && (
            <label className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
              <Camera className="w-3.5 h-3.5" />
              {t('editCover')}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !currentUser) return;
                setCoverFile(file);
                setCoverPreview(URL.createObjectURL(file));
              }} />
            </label>
          )}
        </div>

        <div className="px-4 md:px-6 pb-4 -mt-12 md:-mt-14">
          <div className="flex items-end justify-between mb-3">
            <div className="relative">
              {isOwn && avatarPreview && (
                <div className="absolute -bottom-12 left-0 z-20 flex gap-1">
                  <button onClick={() => handleImageUpload('avatar')} className="bg-success-600 text-white rounded-lg px-2 py-1 text-xs">{t('saveChanges')}</button>
                  <button onClick={() => { setAvatarPreview(null); setAvatarFile(null); }} className="bg-gray-700 text-white rounded-lg px-2 py-1 text-xs">{t('cancel')}</button>
                </div>
              )}
              {isOwn && (
                <label className="absolute -bottom-1 -right-1 z-10 bg-king-500 hover:bg-king-600 text-white rounded-full p-1.5 cursor-pointer transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                  <input type="file" accept={(currentUser?.vip_level || 0) >= 3 ? 'image/png,image/jpeg,image/gif,image/webp' : 'image/png,image/jpeg,image/webp'} className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !currentUser) return;
                    if ((currentUser.vip_level || 0) < 3 && (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif'))) return;
                    setAvatarFile(file);
                    setAvatarPreview(URL.createObjectURL(file));
                  }} />
                </label>
              )}
              <div className="relative bg-white dark:bg-surface-dark-card rounded-full p-1 cursor-pointer" onClick={() => onNavigate('profile', { userId: user.id })}>
                <Avatar user={user} size="2xl" showVerified showAdmin showRing showBadges />
                {avatarPreview && <img src={avatarPreview} alt={t('imagePreview')} className="absolute inset-1 w-[calc(100%-8px)] h-[calc(100%-8px)] rounded-full object-cover" />}
              </div>
            </div>

            <div className="flex gap-2 mb-2">
              {!isOwn && (
                <>
                  {!isFriend && (
                    <button
                      onClick={handleFriendRequest}
                      disabled={friendRequestSent}
                      className="btn-primary text-sm flex items-center gap-1.5"
                    >
                      {friendRequestSent ? <><Check className="w-4 h-4" /> {t('sent')}</> : <><Plus className="w-4 h-4" /> {t('addFriend')}</>}
                    </button>
                  )}
                  <button onClick={handleMessage} className="btn-secondary text-sm">
                    {t('messageUser')}
                  </button>
                  {currentUser?.account_type === 'client' && isDesigner && (
                    <button onClick={() => setShowRatingModal(true)} className="btn-secondary text-sm flex items-center gap-1.5" title={t('rateDesigner')}>
                      <Star className="w-4 h-4 text-king-400" /> {t('rateDesigner')}
                    </button>
                  )}
                  <button onClick={isBlocked ? handleUnblock : handleBlock} className="btn-ghost text-sm" title={isBlocked ? t('unblockUser') : t('blockUser')}>
                    <Ban className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowReportModal(true)} className="btn-ghost text-sm" title={t('reportProfile')}>
                    <Flag className="w-4 h-4" />
                  </button>
                </>
              )}
              {isOwn && (
                <button onClick={() => setEditing(true)} className="btn-secondary text-sm flex items-center gap-1.5">
                  <Edit2 className="w-4 h-4" /> {t('editProfile')}
                </button>
              )}
              <button onClick={handleShare} className="btn-ghost text-sm" title={t('shareProfile')}>
                <Share2 className="w-4 h-4" />
              </button>
              {isOwn && (
                <button onClick={() => { fetchBlockedUsers(); setShowBlockList(true); }} className="btn-ghost text-sm" title={t('blockList')}>
                  <Ban className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Name & Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className={`font-display font-bold text-xl cursor-pointer hover:underline ${shouldUseAnimatedName(user) ? 'animated-name' : ''}`} style={getNameStyle(user)} onClick={() => onNavigate('profile', { userId: user.id })}>
              {getDisplayName(user)}
            </h2>
            {user.is_verified && (
              <span className="badge badge-verified">
                <Check className="w-3 h-3" /> {t('verified')}
              </span>
            )}
            {user.is_pro && (
              <span className="badge badge-pro" style={user.pro_color ? { background: user.pro_color } : undefined}>PRO</span>
            )}
            {(user.vip_level || 0) > 0 && (
              <span className="badge bg-purple-600 text-white"><Star className="w-3 h-3 fill-current" /> VIP {user.vip_level}</span>
            )}
            {user.designer_rank > 0 && (
              <span className="badge badge-rank">
                <Award className="w-3 h-3" /> {getRankName(user.designer_rank)}
              </span>
            )}
            {user.is_admin && (
              <span className="badge bg-king-600 text-white">{t('adminBadge')}</span>
            )}
          </div>

          {/* ID Copy */}
          {isAdmin && <button onClick={() => onNavigate('admin')} className="btn-primary text-xs mb-2">لوحة الإدارة</button>}
          <button onClick={handleCopyId} style={user.profile_card_url && user.profile_card_enabled !== false && (!user.profile_card_expires_at || new Date(user.profile_card_expires_at) > new Date()) ? { backgroundImage: `url(${user.profile_card_url})`, backgroundSize: 'cover' } : undefined} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-100 hover:text-king-500 transition-colors mb-2 rounded-lg px-2 py-1 bg-king-50 dark:bg-surface-dark-alt">
            <span>{t('id')}: {user.king_id}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Bio */}
          {user.bio && <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{user.bio}</p>}
          {user.intro_video_url && (
            <video src={user.intro_video_url} controls playsInline className="w-full max-w-sm rounded-xl mb-3" />
          )}

          {/* Info */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 dark:text-gray-400">
            {user.country && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {user.country}</span>}
            {user.whatsapp_number && (
              <a
                href={`https://wa.me/${user.whatsapp_number.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                aria-label="فتح WhatsApp"
                title="فتح WhatsApp"
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5d] hover:scale-105 transition-all shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5" fill="currentColor" />
                <span className="sr-only">WhatsApp</span>
              </a>
            )}
            {user.age && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {user.age} {t('years')}</span>}
            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-king-400" /> {avgRating.toFixed(1)} ({ratings.length})</span>
            <span>{t('joined')} {formatTime(user.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-king-100 dark:border-surface-dark-border" style={{ scrollbarWidth: 'none' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setViewingFolder(null); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-king-500 text-king-600 dark:text-king-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div className="space-y-3">
          {isOwn && (
            <button onClick={() => onNavigate('home')} className="btn-primary w-full flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> {lang === 'ar' ? 'نشر يومية جديدة' : 'Post New Diary'}
            </button>
          )}
          {posts.length === 0 ? (
            <div className="card p-6 text-center text-gray-500 dark:text-gray-400">{t('noPosts')}</div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar user={post.user || user} size="sm" showVerified showAdmin showRing showBadges onClick={() => onNavigate('profile', { userId: post.user_id })} />
                  <span className={`text-sm font-medium cursor-pointer hover:underline ${shouldUseAnimatedName(post.user || user) ? 'animated-name' : ''}`} style={getNameStyle(post.user || user)} onClick={() => onNavigate('profile', { userId: post.user_id })}>{getDisplayName(post.user || user)}</span>
                  <span className="text-xs text-gray-400 ml-auto">{formatTime(post.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">{post.content}</p>
                {post.media && post.media.length > 0 && <MediaPreview media={post.media} className="mb-2" />}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{post.likes?.length || 0} {t('likes')}</span>
                  <span>{post.comments?.length || 0} {t('comments')}</span>
                  {isOwn && (
                    <button
                      onClick={async () => {
                        const newContent = prompt(t('editPost'), post.content || '');
                        if (newContent !== null) {
                          await supabase.from('posts').update({ content: newContent.trim() }).eq('id', post.id);
                          fetchProfile();
                        }
                      }}
                      className="text-king-500 hover:text-king-600 mr-auto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isOwn && (
                    <button
                      onClick={async () => {
                        await supabase.from('posts').delete().eq('id', post.id);
                        fetchProfile();
                      }}
                      className="text-error-500 hover:text-error-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Portfolio Tab - Designer folders */}
      {activeTab === 'portfolio' && isDesigner && (
        <div className="space-y-3">
          {viewingFolder ? (
            <FolderDetailView
              folder={viewingFolder}
              isOwn={isOwn}
              onBack={() => setViewingFolder(null)}
              onUpdate={fetchProfile}
              onRateDesigner={!isOwn && isClient ? () => setShowRatingModal(true) : undefined}
              currentUser={currentUser}
            />
          ) : (
            <>
              {isOwn && (
                <button onClick={() => setShowAddFolder(true)} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Folder className="w-4 h-4" /> {t('createFolder')}
                </button>
              )}
              {portfolioFolders.length === 0 ? (
                <div className="card p-6 text-center text-gray-500 dark:text-gray-400">{t('noPortfolio')}</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {portfolioFolders.map((folder) => (
                    <div key={folder.id} className="card overflow-hidden cursor-pointer hover:ring-2 hover:ring-king-300 transition-all" onClick={() => setViewingFolder(folder)}>
                      <div className="aspect-video bg-king-100 dark:bg-surface-dark-alt relative">
                        {folder.cover_url ? (
                          <img src={folder.cover_url} alt={folder.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Folder className="w-8 h-8 text-king-300" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-white text-sm font-medium truncate">{folder.name}</p>
                        </div>
                      </div>
                      {folder.description && <p className="text-xs text-gray-500 dark:text-gray-400 p-2 line-clamp-2">{folder.description}</p>}
                      <div className="px-2 pb-2 flex items-center justify-between">
                        <span className="text-xs text-gray-400">{folder.media?.length || 0} {lang === 'ar' ? 'عنصر' : 'items'}</span>
                        {isOwn && (
                          <div className="flex gap-1">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newName = prompt(t('editFolder'), folder.name);
                                if (newName !== null) {
                                  await supabase.from('portfolio_folders').update({ name: newName.trim() }).eq('id', folder.id);
                                  fetchProfile();
                                }
                              }}
                              className="text-king-500 hover:text-king-600"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async (e) => { e.stopPropagation(); await supabase.from('portfolio_folders').delete().eq('id', folder.id); fetchProfile(); }}
                              className="text-error-500 hover:text-error-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {showAddFolder && (
            <AddFolderModal userId={targetId} onClose={() => { setShowAddFolder(false); fetchProfile(); }} />
          )}
        </div>
      )}

      {/* Services Tab - Designer */}
      {activeTab === 'services' && isDesigner && (
        <div className="space-y-3">
          {isOwn && (
            <button onClick={() => setShowAddService(true)} className="btn-primary w-full flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> {t('addService')}
            </button>
          )}
          {services.length === 0 ? (
            <div className="card p-6 text-center text-gray-500 dark:text-gray-400">{t('noServices')}</div>
          ) : (
            services.map((service) => (
              <div key={service.id} role="button" tabIndex={0} className="card overflow-hidden cursor-pointer hover:ring-2 hover:ring-king-300 transition-all" onClick={() => setViewingService(service)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setViewingService(service); }}>
                {service.cover_url && (
                  <div className="aspect-video bg-king-100 dark:bg-surface-dark-alt">
                    <img src={service.cover_url} alt={service.service_name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-king-50">{service.service_name}</h3>
                      {service.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{service.description}</p>}
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <p className="font-bold text-king-600 dark:text-king-400">{service.currency} {service.price.toFixed(2)}</p>
                      {isOwn && (
                        <button
                          onClick={async (event) => { event.stopPropagation(); const { error } = await supabase.from('designer_services').delete().eq('id', service.id); if (error) window.alert(error.message); else await fetchProfile(); }}
                          className="text-error-500 hover:text-error-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {showAddService && (
            <AddServiceModal userId={targetId} onClose={() => { setShowAddService(false); fetchProfile(); }} />
          )}
          {viewingService && (
            <ServicePreviewModal service={viewingService} canRequest={currentUser?.account_type === 'client' && !isOwn} onClose={() => setViewingService(null)} onRequest={() => { setViewingService(null); onNavigate('service-requests'); }} />
          )}
        </div>
      )}

      {/* Client Dashboard */}
      {activeTab === 'dashboard' && isClient && (
        <div className="space-y-4">
          <div className="card p-5 bg-gradient-to-br from-king-50 to-king-100 dark:from-surface-dark-card dark:to-surface-dark-alt">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="w-5 h-5 text-king-500" />
              <h3 className="font-display font-bold text-gray-900 dark:text-king-50">{t('clientDashboard')}</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('clientExclusive')}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-surface-dark-card rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-king-600 dark:text-king-400">{serviceRequests.filter(r => r.status === 'taken' && r.accepted_at).length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('activeRequests')}</p>
              </div>
              <div className="bg-white dark:bg-surface-dark-card rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-success-500">{serviceRequests.filter(r => r.status === 'closed').length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('completedOrders')}</p>
              </div>
              <div className="bg-white dark:bg-surface-dark-card rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-king-600 dark:text-king-400">{favoriteDesigners.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('favoriteDesigners')}</p>
              </div>
            </div>
            {isOwn && (
              <button onClick={() => setShowAddRequest(true)} className="btn-primary w-full mt-4 flex items-center justify-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> {t('postNewRequest')}
              </button>
            )}
          </div>

          {/* My Requests */}
          <div>
            <h3 className="font-display font-semibold text-gray-900 dark:text-king-50 mb-2 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-king-500" /> {t('myRequests')}
            </h3>
            {serviceRequests.length === 0 ? (
              <div className="card p-6 text-center text-gray-500 dark:text-gray-400">{t('noOpenRequests')}</div>
            ) : (
              <div className="space-y-3">
                {serviceRequests.map((req) => (
                  <div key={req.id} className="card p-4">
                    {req.cover_url && (
                      <div className="aspect-video mb-3 rounded-xl overflow-hidden bg-king-100 dark:bg-surface-dark-alt">
                        <img src={req.cover_url} alt={req.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-king-50">{req.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                        req.status === 'open' ? 'bg-success-100 text-success-700 dark:bg-success-700/30 dark:text-success-400' :
                        req.accepted_at ? 'bg-king-100 text-king-700 dark:bg-king-700/30 dark:text-king-400' :
                        req.rejected_at ? 'bg-error-100 text-error-700 dark:bg-error-700/30 dark:text-error-400' :
                        'bg-gray-100 text-gray-600 dark:bg-surface-dark-alt dark:text-gray-400'
                      }`}>
                        {req.accepted_at ? t('designerAccepted') : req.rejected_at ? t('designerRejected') : req.status === 'open' ? t('activeRequests') : t('completedOrders')}
                      </span>
                    </div>
                    {req.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{req.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span className="font-bold text-king-600 dark:text-king-400">{req.currency} {req.price.toFixed(2)}</span>
                      <span>{formatTime(req.created_at)}</span>
                    </div>

                    {/* Accepted: show designer info + start chat */}
                    {req.accepted_at && req.designer && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-king-100 dark:border-surface-dark-border">
                        <Avatar user={req.designer} size="sm" showVerified showAdmin showRing showBadges onClick={() => onNavigate('profile', { userId: req.designer_id! })} />
                        <span className={`text-sm font-medium cursor-pointer hover:underline ${shouldUseAnimatedName(req.designer) ? 'animated-name' : ''}`} style={getNameStyle(req.designer)} onClick={() => onNavigate('profile', { userId: req.designer_id! })}>{getDisplayName(req.designer)}</span>
                        <button onClick={() => onNavigate('messages', { userId: req.designer_id! })} className="btn-primary text-xs flex items-center gap-1 mr-auto">
                          <MessageSquare className="w-3.5 h-3.5" /> {t('startChat')}
                        </button>
                      </div>
                    )}

                    {/* Rejected: show reason */}
                    {req.rejected_at && req.reject_reason && (
                      <div className="mt-2 pt-2 border-t border-king-100 dark:border-surface-dark-border">
                        <p className="text-xs text-error-500 dark:text-error-400">
                          <strong>{t('rejectionReason')}:</strong> {req.reject_reason}
                        </p>
                      </div>
                    )}

                    {/* Rate designer button if completed */}
                    {req.status === 'closed' && req.designer_id && isOwn && (
                      <button
                        onClick={() => onNavigate('profile', { userId: req.designer_id! })}
                        className="btn-secondary text-xs mt-2 flex items-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5" /> {t('rateDesigner')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Favorite Designers */}
          <div>
            <h3 className="font-display font-semibold text-gray-900 dark:text-king-50 mb-2 flex items-center gap-2">
              <Heart className="w-4 h-4 text-king-500" /> {t('favoriteDesigners')}
            </h3>
            {favoriteDesigners.length === 0 ? (
              <div className="card p-6 text-center text-gray-500 dark:text-gray-400">{t('noSuggestions')}</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {favoriteDesigners.map((d) => (
                  <div key={d.id} className="card p-3 flex flex-col items-center text-center cursor-pointer hover:ring-2 hover:ring-king-300 transition-all" onClick={() => onNavigate('profile', { userId: d.id })}>
                    <Avatar user={d} size="lg" showVerified showAdmin showRing showBadges />
                    <span className={`text-sm font-medium mt-2 text-gray-900 dark:text-king-50 ${shouldUseAnimatedName(d) ? 'animated-name' : ''}`} style={getNameStyle(d)}>{getDisplayName(d)}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('id')}: {d.king_id}</span>
                    {d.designer_rank > 0 && (
                      <span className="text-xs text-king-500 mt-1 flex items-center gap-1"><Award className="w-3 h-3" /> {getRankName(d.designer_rank)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('clientSince')}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-king-50 mt-1">{formatTime(user.created_at)}</p>
          </div>

          {showAddRequest && (
            <AddServiceRequestModal userId={targetId} onClose={() => { setShowAddRequest(false); fetchProfile(); }} />
          )}
          {showRejectModal && (
            <RejectModal request={showRejectModal} onClose={() => setShowRejectModal(null)} onDone={fetchProfile} />
          )}
        </div>
      )}

      {/* Reviews Tab - with clickable profiles */}
      {activeTab === 'reviews' && (
        <div className="space-y-3">
          {ratings.length > 0 && (
            <div className="card p-5 bg-gradient-to-br from-king-50 to-white dark:from-surface-dark-alt dark:to-surface-dark-card overflow-hidden">
              <div className="flex items-center justify-between mb-3"><h3 className="font-display font-semibold">آراء العملاء</h3><span className="text-xs text-gray-500">{reviewIndex + 1}/{ratings.length}</span></div>
              <div className="min-h-20 transition-all duration-300">
                <div className="flex items-center gap-2 mb-2"><Avatar user={ratings[reviewIndex]?.rater} size="sm" showVerified showAdmin /><span className="font-medium text-sm">{getDisplayName(ratings[reviewIndex]?.rater)}</span><div className="flex">{[1,2,3,4,5].map((star) => <Star key={star} className={`w-3.5 h-3.5 ${star <= (ratings[reviewIndex]?.score || 0) ? 'text-king-400 fill-current' : 'text-gray-300'}`} />)}</div></div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{ratings[reviewIndex]?.comment || 'تجربة موثوقة مع المصمم'}</p>
              </div>
              <div className="flex justify-center gap-1 mt-3">{ratings.map((rating, index) => <button key={rating.id} aria-label={`review ${index + 1}`} onClick={() => setReviewIndex(index)} className={`h-1.5 rounded-full transition-all ${index === reviewIndex ? 'w-6 bg-king-500' : 'w-1.5 bg-king-200'}`} />)}</div>
            </div>
          )}
          {ratings.length === 0 ? (
            <div className="card p-6 text-center text-gray-500 dark:text-gray-400">{t('noReviews')}</div>
          ) : (
            ratings.map((rating) => (
              <div key={rating.id} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar user={rating.rater} size="sm" showVerified showAdmin showRing showBadges onClick={() => rating.rater && onNavigate('profile', { userId: rating.rater.id })} />
                  <span className={`text-sm font-medium cursor-pointer hover:underline ${shouldUseAnimatedName(rating.rater) ? 'animated-name' : ''}`} style={getNameStyle(rating.rater)} onClick={() => rating.rater && onNavigate('profile', { userId: rating.rater.id })}>{getDisplayName(rating.rater)}</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-3.5 h-3.5 ${star <= rating.score ? 'text-king-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 ml-auto">{formatTime(rating.created_at)}</span>
                </div>
                {rating.comment && <p className="text-sm text-gray-600 dark:text-gray-400">{rating.comment}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* About Tab */}
      {activeTab === 'about' && (
        <div className="space-y-4">
          {isOwn && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-gray-900 dark:text-king-50 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-king-500" /> {t('language')}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => lang !== 'ar' && toggleLang()}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    lang === 'ar' ? 'bg-king-500 text-white' : 'btn-secondary'
                  }`}
                >
                  {t('arabic')}
                </button>
                <button
                  onClick={() => lang !== 'en' && toggleLang()}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    lang === 'en' ? 'bg-king-500 text-white' : 'btn-secondary'
                  }`}
                >
                  {t('english')}
                </button>
              </div>
            </div>
          )}

          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-display font-semibold text-gray-900 dark:text-king-50 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-king-500" /> {t('summary')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{user.cv_summary || t('notProvided')}</p>
            </div>
            <div>
              <h3 className="font-display font-semibold text-gray-900 dark:text-king-50 mb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-king-500" /> {t('experience')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{user.cv_experience || t('notProvided')}</p>
            </div>
            <div>
              <h3 className="font-display font-semibold text-gray-900 dark:text-king-50 mb-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-king-500" /> {t('education')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{user.cv_education || t('notProvided')}</p>
            </div>
            <div>
              <h3 className="font-display font-semibold text-gray-900 dark:text-king-50 mb-2">{t('skills')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{user.cv_skills || t('notProvided')}</p>
            </div>
            {user.cv_phone && (
              <div>
                <h3 className="font-display font-semibold text-gray-900 dark:text-king-50 mb-2">{t('phone')}</h3>
                <a href={`tel:${user.cv_phone.replace(/[^\d+]/g, '')}`} className="text-sm text-king-600 dark:text-king-400 hover:underline flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {user.cv_phone}
                </a>
              </div>
            )}
            {user.social_links && Object.entries(user.social_links).some(([, value]) => value) && (
              <div className="md:col-span-2">
                <h3 className="font-display font-semibold text-gray-900 dark:text-king-50 mb-2">{t('socialLinks')}</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(user.social_links).filter(([, value]) => value).map(([platform, value]) => (
                    <a key={platform} href={String(value).startsWith('http') ? String(value) : `https://${value}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-king-50 dark:bg-surface-dark-alt text-king-600 dark:text-king-400 text-xs hover:bg-king-100 transition-colors">
                      <ExternalLink className="w-3 h-3" /> {platform}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {user.cv_location && (
              <div>
                <h3 className="font-display font-semibold text-gray-900 dark:text-king-50 mb-2">{t('location')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{user.cv_location}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <EditProfileModal user={user} onClose={() => { setEditing(false); fetchProfile(); refreshProfile(); }} />
      )}
      {showShareModal && <ProfileShareModal profile={user} onClose={() => setShowShareModal(false)} />}
      {showBlockList && <BlockListModal users={blockedUsers} onUnblock={handleUnblockUser} onClose={() => setShowBlockList(false)} />}
      {showReportModal && <ReportProfileModal profile={user} reporter={currentUser} onClose={() => setShowReportModal(false)} />}
      {showRatingModal && <RatingModal targetUser={user} onClose={() => setShowRatingModal(false)} onSubmit={handleRateDesigner} />}
    </div>
  );
}

// --- Folder Detail View ---
function FolderDetailView({ folder, isOwn, onBack, onUpdate, onRateDesigner, currentUser }: {
  folder: PortfolioFolder;
  isOwn: boolean;
  onBack: () => void;
  onUpdate: () => void;
  onRateDesigner?: () => void;
  currentUser: Profile | null;
}) {
  const { t, lang } = useLang();
  const [uploading, setUploading] = useState(false);
  const [folderRatings, setFolderRatings] = useState<Rating[]>([]);
  const [showRatings, setShowRatings] = useState(false);
  const [privacyShield, setPrivacyShield] = useState(false);
  const [secureMedia, setSecureMedia] = useState<MediaItem[]>(safeMediaList(folder.media));

  useEffect(() => {
    let cancelled = false;
    const loadSignedMedia = async () => {
      const resolved = await Promise.all(safeMediaList(folder.media).map(async (item) => {
        const path = item.storage_path || (() => {
          const marker = '/object/public/media/';
          const index = item.url.indexOf(marker);
          return index >= 0 ? decodeURIComponent(item.url.slice(index + marker.length)) : null;
        })();
        if (!path) return item;
        const { data } = await supabase.storage.from(STORAGE_BUCKETS.PORTFOLIO).createSignedUrl(path, 600);
        return data?.signedUrl ? { ...item, url: data.signedUrl } : item;
      }));
      if (!cancelled) setSecureMedia(resolved);
    };
    loadSignedMedia();
    return () => { cancelled = true; };
  }, [folder.media]);

  useEffect(() => {
    const handleVisibilityChange = () => setPrivacyShield(document.visibilityState !== 'visible');
    const handleWindowBlur = () => setPrivacyShield(true);
    const handleWindowFocus = () => setPrivacyShield(false);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    supabase
      .from('ratings')
      .select('*, rater:profiles!ratings_rater_id_fkey(*)')
      .eq('rated_user_id', folder.user_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setFolderRatings(data as Rating[]));
  }, [folder.user_id, onUpdate]);

  const handleAddMedia = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newMedia: MediaItem[] = [];
    for (const file of Array.from(files)) {
      const path = `${folder.user_id}/folder-${folder.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.PORTFOLIO).upload(path, file);
      if (!error) {
        const { data: signed } = await supabase.storage.from(STORAGE_BUCKETS.PORTFOLIO).createSignedUrl(path, 600);
        newMedia.push({ type: getFileType(file.name), url: signed?.signedUrl || '', storage_path: path, name: file.name, size: file.size });
      }
    }
    const updatedMedia = [...safeMediaList(folder.media), ...newMedia];
    const { error } = await supabase.from('portfolio_folders').update({ media: updatedMedia }).eq('id', folder.id);
    setUploading(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    setSecureMedia([...secureMedia, ...newMedia]);
    onUpdate();
  };

  const handleRemoveMedia = async (index: number) => {
    const updatedMedia = safeMediaList(folder.media).filter((_, i) => i !== index);
    const { error } = await supabase.from('portfolio_folders').update({ media: updatedMedia }).eq('id', folder.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    onUpdate();
  };

  const handleRenameMedia = async (index: number) => {
    const item = safeMediaList(folder.media)[index];
    if (!item) return;
    const newName = prompt(t('editFolder'), item.name || '');
    if (newName === null) return;
    const updatedMedia = safeMediaList(folder.media).map((m, i) => i === index ? { ...m, name: newName.trim() } : m);
    const { error } = await supabase.from('portfolio_folders').update({ media: updatedMedia }).eq('id', folder.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    onUpdate();
  };

  const avgRating = folderRatings.length > 0 ? folderRatings.reduce((s, r) => s + r.score, 0) / folderRatings.length : 0;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  return (
    <div className="space-y-3" onContextMenu={handleContextMenu}>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-king-500 hover:text-king-600">
        <ChevronLeft className="w-4 h-4" /> {lang === 'ar' ? 'رجوع' : 'Back'}
      </button>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{folder.name}</h3>
          <div className="flex items-center gap-2">
            {!isOwn && onRateDesigner && (
              <button onClick={onRateDesigner} className="btn-secondary text-xs flex items-center gap-1">
                <Star className="w-3.5 h-3.5" /> {t('rateDesigner')}
              </button>
            )}
            <button onClick={() => setShowRatings(!showRatings)} className="flex items-center gap-1 text-xs text-king-500 hover:text-king-600">
              <Star className="w-3.5 h-3.5 text-king-400" /> {avgRating.toFixed(1)} ({folderRatings.length})
            </button>
            {isOwn && (
              <button
                onClick={async () => {
                  const newDesc = prompt(t('editFolder'), folder.description || '');
                  if (newDesc !== null) {
                    await supabase.from('portfolio_folders').update({ description: newDesc.trim() }).eq('id', folder.id);
                    onUpdate();
                  }
                }}
                className="text-king-500 hover:text-king-600"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {folder.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{folder.description}</p>}
        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
          <Lock className="w-3 h-3" /> {lang === 'ar' ? 'محتوى محمي - للمشاهدة فقط' : 'Protected content - view only'}
        </div>
      </div>

      {showRatings && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-display font-semibold text-sm text-gray-900 dark:text-king-50">{t('reviews')}</h4>
            <button onClick={() => setShowRatings(false)} className="p-1 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
          {folderRatings.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">{t('noReviews')}</p>
          ) : (
            folderRatings.map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-2 hover:bg-king-50 dark:hover:bg-surface-dark-alt rounded-xl">
                <Avatar user={r.rater} size="sm" showVerified showAdmin showRing showBadges />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-king-50 block truncate">{getDisplayName(r.rater)}</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3 h-3 ${s <= r.score ? 'text-king-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`} />
                    ))}
                  </div>
                  {r.comment && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.comment}</p>}
                </div>
                <span className="text-xs text-gray-400">{formatTime(r.created_at, lang)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {isOwn && (
        <label className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer">
          <Upload className="w-4 h-4" /> {uploading ? (lang === 'ar' ? 'جاري الرفع...' : 'Uploading...') : t('addContent')}
          <input
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.svg,.svga,.mkv,.avi,.mov,.webm,.doc,.docx,.txt,.rtf,.xls,.xlsx,.ppt,.pptx"
            className="hidden"
            onChange={(e) => e.target.files && handleAddMedia(e.target.files)}
          />
        </label>
      )}
      {secureMedia.length === 0 ? (
        <div className="card p-6 text-center text-gray-500 dark:text-gray-400">{lang === 'ar' ? 'لا يوجد محتوى' : 'No content yet'}</div>
      ) : (
        <div
          className="relative grid grid-cols-2 md:grid-cols-3 gap-3 select-none overflow-hidden"
          style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          onDragStart={(e) => e.preventDefault()}
        >
          <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.12] overflow-hidden grid grid-cols-2 md:grid-cols-3 gap-10 p-6 select-none">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="text-xs font-semibold text-king-700 dark:text-king-200 -rotate-12 whitespace-nowrap">{currentUser?.king_id ? `KING ${currentUser.king_id}` : 'PROTECTED PORTFOLIO'}</span>
            ))}
          </div>
          {privacyShield && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-950 text-white text-center p-6">
              <div>
                <Lock className="w-10 h-10 mx-auto mb-3" />
                <p className="font-semibold">{lang === 'ar' ? 'المحتوى محمي' : 'Content protected'}</p>
                <p className="text-xs text-gray-300 mt-1">{lang === 'ar' ? 'تم إخفاء المعرض مؤقتاً لحماية الخصوصية' : 'The portfolio is hidden while the page is not active'}</p>
              </div>
            </div>
          )}
          {secureMedia.map((item, i) => (
            <div key={i} className="card overflow-hidden relative group" onContextMenu={handleContextMenu}>
              {item.type === 'image' || item.type === 'gif' ? (
                <img
                  src={item.url}
                  alt={item.name}
                  draggable={false}
                  className="w-full aspect-square object-cover pointer-events-none"
                  onContextMenu={handleContextMenu}
                  onDragStart={(e) => e.preventDefault()}
                />
              ) : item.type === 'video' ? (
                <video
                  src={item.url}
                  controls
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture
                  className="w-full aspect-square object-cover"
                  onContextMenu={handleContextMenu}
                  onDragStart={(e) => e.preventDefault()}
                />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center bg-king-100 dark:bg-surface-dark-alt">
                  <FileText className="w-8 h-8 text-king-400" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{item.name || `#${i + 1}`}</p>
              </div>
              {isOwn && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRenameMedia(i); }}
                    className="bg-white/90 dark:bg-surface-dark-card/90 rounded-lg p-1.5 text-king-500 hover:text-king-600 shadow-sm"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveMedia(i); }}
                    className="bg-white/90 dark:bg-surface-dark-card/90 rounded-lg p-1.5 text-error-500 hover:text-error-600 shadow-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Add Folder Modal ---
function AddFolderModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t, lang } = useLang();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCoverUpload = async (file: File) => {
    const path = `${userId}/folder-cover-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.MEDIA).upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKETS.MEDIA).getPublicUrl(path);
      setCoverUrl(publicUrl);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('portfolio_folders').insert({
      user_id: userId,
      name: name.trim(),
      description: description.trim(),
      cover_url: coverUrl,
      media: [],
    });
    setSaving(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-md p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('createFolder')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('folderName')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('folderDescription')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input-field resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('folderCover')}</label>
            {coverUrl ? (
              <div className="relative aspect-video rounded-xl overflow-hidden">
                <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />
                <button onClick={() => setCoverUrl(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-king-200 dark:border-surface-dark-border rounded-xl p-4 text-center cursor-pointer hover:border-king-400 transition-colors">
                <Camera className="w-6 h-6 text-king-400 mx-auto mb-1" />
                <span className="text-xs text-gray-500">{lang === 'ar' ? 'اختر صورة الغلاف' : 'Choose cover image'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} />
              </label>
            )}
          </div>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary w-full">
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t('saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ServicePreviewModal({ service, canRequest, onClose, onRequest }: { service: DesignerService; canRequest: boolean; onClose: () => void; onRequest: () => void }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        {service.cover_url && <img src={service.cover_url} alt={service.service_name} className="w-full max-h-72 object-cover" />}
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-display font-bold text-xl text-gray-900 dark:text-king-50">{service.service_name}</h2><p className="text-sm text-gray-500 mt-1">معاينة الخدمة</p></div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-king-100 dark:hover:bg-surface-dark-alt"><X className="w-5 h-5 text-gray-500" /></button>
          </div>
          <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{service.description || t('notProvided')}</p>
          <div className="flex items-center justify-between border-t border-king-100 dark:border-surface-dark-border pt-4">
            <span className="text-xl font-bold text-king-600 dark:text-king-400">{service.currency} {Number(service.price || 0).toFixed(2)}</span>
            {canRequest && <button onClick={onRequest} className="btn-primary">{t('requestService')}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Add Service Modal ---
function AddServiceModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t, lang } = useLang();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCoverUpload = async (file: File) => {
    const path = `${userId}/service-cover-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.MEDIA).upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKETS.MEDIA).getPublicUrl(path);
      setCoverUrl(publicUrl);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('designer_services').insert({
      user_id: userId,
      service_name: name.trim(),
      description: description.trim(),
      price: parseFloat(price) || 0,
      currency,
      cover_url: coverUrl,
    });
    setSaving(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-md p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('addService')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('serviceName')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('serviceDescription')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input-field resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('servicePrice')}</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('currency') || 'Currency'}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
                <option value="USD">USD</option>
                <option value="SAR">SAR</option>
                <option value="EGP">EGP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('serviceCover')}</label>
            {coverUrl ? (
              <div className="relative aspect-video rounded-xl overflow-hidden">
                <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />
                <button onClick={() => setCoverUrl(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-king-200 dark:border-surface-dark-border rounded-xl p-4 text-center cursor-pointer hover:border-king-400 transition-colors">
                <Camera className="w-6 h-6 text-king-400 mx-auto mb-1" />
                <span className="text-xs text-gray-500">{lang === 'ar' ? 'اختر صورة الغلاف' : 'Choose cover image'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} />
              </label>
            )}
          </div>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary w-full">
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t('saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Add Service Request Modal (Client) ---
function AddServiceRequestModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t, lang } = useLang();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCoverUpload = async (file: File) => {
    const path = `${userId}/request-cover-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.MEDIA).upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKETS.MEDIA).getPublicUrl(path);
      setCoverUrl(publicUrl);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const { data: reqData } = await supabase.from('service_requests').insert({
      user_id: userId,
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(price) || 0,
      currency,
      cover_url: coverUrl,
      status: 'open',
    }).select().single();

    // Notify all designer friends
    if (reqData) {
      const { data: friends } = await supabase
        .from('friendships')
        .select('receiver:profiles!friendships_receiver_id_fkey(id), requester:profiles!friendships_requester_id_fkey(id)')
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq('status', 'accepted');
      for (const f of (friends as unknown as { receiver: Profile; requester: Profile }[]) || []) {
        const other = f.receiver.id === userId ? f.requester : f.receiver;
        if (other.account_type === 'designer') {
          await supabase.from('notifications').insert({
            user_id: other.id,
            actor_id: userId,
            type: 'service_request',
            entity_type: 'service_request',
            entity_id: reqData.id,
          });
        }
      }
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-md p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('requestService')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('requestTitle')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('requestDescription')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input-field resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('requestPrice')}</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('currency') || 'Currency'}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
                <option value="USD">USD</option>
                <option value="SAR">SAR</option>
                <option value="EGP">EGP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('requestCover')}</label>
            {coverUrl ? (
              <div className="relative aspect-video rounded-xl overflow-hidden">
                <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />
                <button onClick={() => setCoverUrl(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-king-200 dark:border-surface-dark-border rounded-xl p-4 text-center cursor-pointer hover:border-king-400 transition-colors">
                <Camera className="w-6 h-6 text-king-400 mx-auto mb-1" />
                <span className="text-xs text-gray-500">{lang === 'ar' ? 'اختر صورة الغلاف' : 'Choose cover image'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} />
              </label>
            )}
          </div>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn-primary w-full">
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t('publishToDesigners')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Reject Modal (Designer) ---
function RejectModal({ request, onClose, onDone }: { request: ServiceRequest; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useLang();
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
    onClose();
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

function EditProfileModal({ user, onClose }: { user: Profile; onClose: () => void }) {
  const { t } = useLang();
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [username, setUsername] = useState(user.username || '');
  const [bio, setBio] = useState(user.bio || '');
  const [country, setCountry] = useState(user.country || '');
  const [age, setAge] = useState(user.age?.toString() || '');
  const [cvSummary, setCvSummary] = useState(user.cv_summary || '');
  const [cvExperience, setCvExperience] = useState(user.cv_experience || '');
  const [cvEducation, setCvEducation] = useState(user.cv_education || '');
  const [cvSkills, setCvSkills] = useState(user.cv_skills || '');
  const [cvPhone, setCvPhone] = useState(user.cv_phone || '');
  const [cvLocation, setCvLocation] = useState(user.cv_location || '');
  const [whatsappNumber, setWhatsappNumber] = useState(user.whatsapp_number || '');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(user.social_links || {});
  const [saving, setSaving] = useState(false);

  const SOCIAL_PLATFORMS = ['instagram', 'twitter', 'tiktok', 'youtube', 'facebook', 'behance', 'dribbble', 'linkedin', 'website'];

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: displayName,
      username: username || null,
      bio,
      country,
      age: age ? parseInt(age) : null,
      cv_summary: cvSummary,
      cv_experience: cvExperience,
      cv_education: cvEducation,
      cv_skills: cvSkills,
      cv_phone: cvPhone,
      cv_location: cvLocation,
      whatsapp_number: whatsappNumber || null,
      social_links: socialLinks,
    }).eq('id', user.id);
    setSaving(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-surface-dark-card">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('editProfile')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('displayName')}</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('username')}</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('bio')}</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="input-field resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('country')}</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('age')}</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="input-field" />
            </div>
          </div>

          <div className="pt-3 border-t border-king-100 dark:border-surface-dark-border">
            <h3 className="font-display font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">{t('cvResumeInfo')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('summary')}</label>
                <textarea value={cvSummary} onChange={(e) => setCvSummary(e.target.value)} rows={2} className="input-field resize-none text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('experience')}</label>
                <textarea value={cvExperience} onChange={(e) => setCvExperience(e.target.value)} rows={3} className="input-field resize-none text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('education')}</label>
                <textarea value={cvEducation} onChange={(e) => setCvEducation(e.target.value)} rows={3} className="input-field resize-none text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('skills')}</label>
                <input value={cvSkills} onChange={(e) => setCvSkills(e.target.value)} className="input-field text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('phone')}</label>
                  <input value={cvPhone} onChange={(e) => setCvPhone(e.target.value)} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('whatsappOptional')}</label>
                  <input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+966..." className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('location')}</label>
                  <input value={cvLocation} onChange={(e) => setCvLocation(e.target.value)} className="input-field text-sm" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-king-100 dark:border-surface-dark-border">
            <h3 className="font-display font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">{t('socialLinks')}</h3>
            <div className="space-y-2">
              {SOCIAL_PLATFORMS.map((platform) => (
                <div key={platform}>
                  <label className="block text-xs text-gray-500 mb-0.5">{t(platform as TranslationKey) || platform}</label>
                  <input
                    value={socialLinks[platform] || ''}
                    onChange={(e) => setSocialLinks({ ...socialLinks, [platform]: e.target.value })}
                    placeholder={`https://${platform}.com/...`}
                    className="input-field text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t('saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileShareModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { t } = useLang();
  const url = `${window.location.origin}?profile=${profile.king_id}`;
  const copy = async () => { await copyToClipboard(url); onClose(); };
  const external = async () => {
    if (navigator.share) { try { await navigator.share({ title: getDisplayName(profile), url }); } catch { /* cancelled */ } }
    else await copyToClipboard(url);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-display font-bold text-lg">{t('shareProfile')}</h2><button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button></div>
        <div className="flex items-center gap-3 p-3 bg-king-50 dark:bg-surface-dark-alt rounded-xl mb-4"><Avatar user={profile} size="md" /><span className="font-medium">{getDisplayName(profile)}</span></div>
        <div className="space-y-2"><button onClick={copy} className="btn-secondary w-full flex items-center justify-center gap-2"><Copy className="w-4 h-4" /> {t('copyLink')}</button><button onClick={external} className="btn-primary w-full flex items-center justify-center gap-2"><ExternalLink className="w-4 h-4" /> {t('shareExternal')}</button></div>
      </div>
    </div>
  );
}

function BlockListModal({ users, onUnblock, onClose }: { users: Profile[]; onUnblock: (id: string) => void; onClose: () => void }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-display font-bold text-lg">{t('blockList')}</h2><button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button></div>
        {users.length === 0 ? <p className="text-sm text-gray-500 text-center py-6">{t('noBlockedUsers')}</p> : <div className="space-y-2 max-h-72 overflow-y-auto">{users.map((user) => <div key={user.id} className="flex items-center gap-3 p-2 rounded-xl"><Avatar user={user} size="sm" /><span className="flex-1 text-sm">{getDisplayName(user)}</span><button onClick={() => onUnblock(user.id)} className="text-xs text-king-600 hover:underline">{t('unblockUser')}</button></div>)}</div>}
      </div>
    </div>
  );
}

function ReportProfileModal({ profile, reporter, onClose }: { profile: Profile; reporter: Profile | null; onClose: () => void }) {
  const { t } = useLang();
  const [reason, setReason] = useState('spam');
  const [video, setVideo] = useState<File | null>(null);
  const [videoError, setVideoError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!reporter) return;
    setSaving(true);
    let videoUrl: string | null = null;
    if (video) {
      const path = `${reporter.id}/reports/${Date.now()}-${video.name}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.MEDIA).upload(path, video);
      if (!error) videoUrl = supabase.storage.from(STORAGE_BUCKETS.MEDIA).getPublicUrl(path).data.publicUrl;
    }
    await supabase.from('reports').insert({ reporter_id: reporter.id, reported_user_id: profile.id, entity_type: 'user', entity_id: profile.id, reason, video_url: videoUrl });
    setSaving(false);
    onClose();
  };
  const handleVideoSelect = (file: File) => {
    setVideoError('');
    if (file.size > 100 * 1024 * 1024) { setVideoError(t('reportVideoMaxOneMin')); return; }
    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    videoEl.onloadedmetadata = () => {
      if (videoEl.duration > 60) { setVideoError(t('reportVideoMaxOneMin')); setVideo(null); }
      else setVideo(file);
      URL.revokeObjectURL(videoEl.src);
    };
    videoEl.src = URL.createObjectURL(file);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-sm p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-display font-bold text-lg">{t('reportProfile')}</h2><button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button></div>
        <div className="flex items-center gap-3 bg-king-50 dark:bg-surface-dark-alt rounded-xl p-3 mb-3">
          <Avatar user={profile} size="sm" showVerified showAdmin />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{getDisplayName(profile)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('id')}: {profile.king_id}</p>
          </div>
        </div>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field mb-3">
          <option value="spam">{t('reportReasonSpam')}</option>
          <option value="harassment">{t('reportReasonHarassment')}</option>
          <option value="fake">{t('reportReasonFake')}</option>
          <option value="inappropriate">{t('reportReasonInappropriate')}</option>
          <option value="hate">{t('reportReasonHate')}</option>
          <option value="violence">{t('reportReasonViolence')}</option>
          <option value="other">{t('reportReasonOther')}</option>
        </select>
        <label className="block border-2 border-dashed border-king-200 dark:border-surface-dark-border rounded-xl p-3 text-center text-xs text-gray-500 cursor-pointer mb-2">
          {video ? t('videoAttached') : t('attachVideo')} - {t('reportVideoMaxOneMin')}
          <input type="file" accept="video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleVideoSelect(file); }} />
        </label>
        {videoError && <p className="text-xs text-error-500 mb-2">{videoError}</p>}
        {video && <p className="text-xs text-success-500 mb-2 truncate">{video.name}</p>}
        <button onClick={submit} disabled={saving} className="btn-primary w-full">{saving ? t('loading') : t('report')}</button>
      </div>
    </div>
  );
}

// --- Rating Modal ---
function RatingModal({ targetUser, onClose, onSubmit }: { targetUser: Profile; onClose: () => void; onSubmit: (score: number, comment: string) => void }) {
  const { t, lang } = useLang();
  const [score, setScore] = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = () => {
    if (score === 0) return;
    setSaving(true);
    onSubmit(score, comment);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-sm p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('rateDesigner')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="flex items-center gap-3 bg-king-50 dark:bg-surface-dark-alt rounded-xl p-3 mb-4">
          <Avatar user={targetUser} size="md" showVerified showAdmin showRing showBadges />
          <span className="font-medium text-gray-900 dark:text-king-50">{getDisplayName(targetUser)}</span>
        </div>
        <div className="flex justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onMouseEnter={() => setHoverScore(s)}
              onMouseLeave={() => setHoverScore(0)}
              onClick={() => setScore(s)}
              className="transition-transform hover:scale-110"
            >
              <Star className={`w-8 h-8 ${(hoverScore || score) >= s ? 'text-king-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={lang === 'ar' ? 'اكتب تعليقك (اختياري)...' : 'Write a comment (optional)...'}
          rows={3}
          className="input-field resize-none mb-4"
        />
        <button onClick={handleSubmit} disabled={saving || score === 0} className="btn-primary w-full">
          {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t('submitRating')}
        </button>
      </div>
    </div>
  );
}
