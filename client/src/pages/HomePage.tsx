import { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Globe, Users, Lock, Trash2, Flag, Plus, Send, X, Image as ImageIcon, Eye, Edit2, Shield, Type, Palette, Copy, ExternalLink, BookOpen, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { supabase, STORAGE_BUCKETS } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import { Avatar } from '@/components/Avatar';
import { MediaPreview } from '@/components/MediaPreview';
import { MediaStudio, type StudioEdit, DEFAULT_EDIT } from '@/components/MediaStudio';
import type { MediaItemWithEdit } from '@/components/MediaPreview';
import { getDisplayName, getNameColor, getNameStyle, shouldUseAnimatedName, formatTime, getEncouragementMessages, getFileType } from '@/lib/helpers';
import type { Post, Story, Profile, MediaItem, PortfolioFolder } from '@/types';

interface HomePageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { profile } = useAuth();
  const { t, lang } = useLang();
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<(Story & { user: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [encouragement, setEncouragement] = useState(getEncouragementMessages(lang)[0]);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        user:profiles!posts_user_id_fkey(*),
        likes(user_id),
        comments(id)
      `)
    .order('created_at', { ascending: false })
      .limit(50);

    setPosts(Array.isArray(data) ? data as Post[] : []);
  }, []);

  const fetchStories = useCallback(async () => {
    const { data } = await supabase
      .from('stories')
      .select(`
        *,
        user:profiles!stories_user_id_fkey(*),
        views:story_views(user_id, reaction)
      `)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (Array.isArray(data)) {
      const grouped = (data as (Story & { user: Profile })[]).reduce((acc, s) => {
        if (!acc.find((g) => g.user_id === s.user_id)) acc.push(s);
        return acc;
      }, [] as (Story & { user: Profile })[]);
      setStories(grouped);
    } else setStories([]);
  }, []);

  useEffect(() => {
    Promise.all([fetchPosts(), fetchStories()]).finally(() => setLoading(false));

    const interval = setInterval(() => {
      const messages = getEncouragementMessages(lang);
      setEncouragement(messages[Math.floor(Math.random() * messages.length)]);
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchPosts, fetchStories, lang]);

  useEffect(() => {
    const sharedStoryId = new URLSearchParams(window.location.search).get('story_id');
    if (!sharedStoryId || viewingStory) return;
    supabase.from('stories').select('*, user:profiles!stories_user_id_fkey(*), views:story_views(user_id, reaction)').eq('id', sharedStoryId).maybeSingle().then(({ data }) => {
      if (data) setViewingStory(data as Story & { user: Profile });
    });
  }, [viewingStory]);

  const handleLike = async (postId: string, hasLiked: boolean) => {
    if (!profile) return;
    if (hasLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', profile.id);
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: profile.id });
      if (profile) {
        const post = posts.find((p) => p.id === postId);
        if (post && post.user_id !== profile.id) {
          await supabase.from('notifications').insert({
            user_id: post.user_id,
            actor_id: profile.id,
            type: 'like',
            entity_type: 'post',
            entity_id: postId,
          });
        }
      }
    }
    fetchPosts();
  };

  const handleDeletePost = async (postId: string) => {
    await supabase.from('posts').delete().eq('id', postId);
    fetchPosts();
  };

  const handleEditPost = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (post) setEditingPost(post);
  };

  const handleReport = async (entityType: 'post' | 'story' | 'comment', entityId: string, reportedUserId: string) => {
    if (!profile) return;
    await supabase.from('reports').insert({
      reporter_id: profile.id,
      reported_user_id: reportedUserId,
      entity_type: entityType,
      entity_id: entityId,
      reason: 'Reported from feed',
    });
  };

  const handleShare = (postId: string) => setSharePostId(postId);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full shimmer-bg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 shimmer-bg rounded" />
                <div className="h-3 w-20 shimmer-bg rounded" />
              </div>
            </div>
            <div className="h-32 mt-4 shimmer-bg rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Encouragement Banner */}
      <div className="bg-gradient-to-r from-king-400 to-king-600 rounded-2xl p-4 text-white shadow-lg shadow-king-500/20 animate-fade-in">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">✨</span>
          <span className="text-xs font-medium uppercase tracking-wide opacity-80">{t('dailyInspiration')}</span>
        </div>
        <p className="text-lg font-display font-medium leading-snug">{encouragement}</p>
      </div>

      {/* Stories Bar */}
      <div className="card p-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {/* Create Story */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowCreateStory(true)}
              className="w-16 h-16 rounded-full border-2 border-dashed border-king-300 dark:border-surface-dark-border flex items-center justify-center text-king-500 hover:bg-king-50 dark:hover:bg-surface-dark-card transition-colors"
            >
              <Plus className="w-6 h-6" />
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-400">{t('yourStory')}</span>
          </div>

          {stories.map((story) => {
            const hasViewed = story.views?.some((v) => v.user_id === profile?.id);
            return (
              <div key={story.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer" onClick={() => setViewingStory(story)}>
                <div className={hasViewed ? 'story-ring-viewed' : 'story-ring'}>
                  <div className="bg-white dark:bg-surface-dark rounded-full p-0.5">
                    <Avatar user={story.user} size="lg" />
                  </div>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400 max-w-[64px] truncate">
                  {getDisplayName(story.user)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Post Button */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <Avatar user={profile} size="md" showVerified />
          <button
            onClick={() => setShowCreatePost(true)}
            className="flex-1 text-left bg-king-50 dark:bg-surface-dark-alt hover:bg-king-100 dark:hover:bg-surface-dark-card rounded-xl px-4 py-2.5 text-gray-500 dark:text-gray-400 transition-colors"
          >
            {t('shareYourDesign')}
          </button>
        </div>
      </div>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">{t('noPostsYet')}</p>
        </div>
      ) : (
        posts.map((post) => {
          const hasLiked = post.likes?.some((l) => l.user_id === profile?.id);
          const likeCount = post.likes?.length || 0;
          const commentCount = post.comments?.length || 0;
          const nameColor = getNameColor(post.user);
          const isOwn = post.user_id === profile?.id;
          const audienceIcon = post.audience === 'public' ? <Globe className="w-3.5 h-3.5" /> : post.audience === 'friends' ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />;

          return (
            <div key={post.id} className="card p-4 animate-slide-up">
              <div className="flex items-start gap-3 mb-3">
                <Avatar user={post.user} size="md" showRing showVerified showAdmin showBadges onClick={() => onNavigate('profile', { userId: post.user_id })} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-medium text-sm ${shouldUseAnimatedName(post.user) ? 'animated-name' : ''}`}
                      style={getNameStyle(post.user)}
                    >
                      {getDisplayName(post.user)}
                    </span>
                    {post.user?.is_admin && (
                      <span className="inline-flex items-center gap-0.5 bg-king-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                        <Shield className="w-2.5 h-2.5" /> {t('adminBadge')}
                      </span>
                    )}
                    {post.user?.is_verified && (
                      <svg className="w-3.5 h-3.5 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      {audienceIcon} {formatTime(post.created_at)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('id')}: {post.user?.king_id}</span>
                </div>
                <div className="relative group">
                  <button className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-card rounded-lg text-gray-400">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white dark:bg-surface-dark-card border border-king-100 dark:border-surface-dark-border rounded-xl shadow-lg py-1 z-10 min-w-[140px]">
                    {isOwn && (
                      <button onClick={() => handleEditPost(post.id)} className="flex items-center gap-2 px-3 py-2 text-sm text-king-600 dark:text-king-400 hover:bg-king-50 dark:hover:bg-surface-dark-alt">
                        <Edit2 className="w-4 h-4" /> {t('editPost')}
                      </button>
                    )}
                    {isOwn && (
                      <button onClick={() => handleDeletePost(post.id)} className="flex items-center gap-2 px-3 py-2 text-sm text-error-500 hover:bg-error-50 dark:hover:bg-error-700/20">
                        <Trash2 className="w-4 h-4" /> {t('delete')}
                      </button>
                    )}
                    {!isOwn && (
                      <button onClick={() => handleReport('post', post.id, post.user_id)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-king-50 dark:hover:bg-surface-dark-alt">
                        <Flag className="w-4 h-4" /> {t('report')}
                      </button>
                    )}
                    <button onClick={() => handleShare(post.id)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-king-50 dark:hover:bg-surface-dark-alt">
                      <Share2 className="w-4 h-4" /> {t('share')}
                    </button>
                  </div>
                </div>
              </div>

              {post.content && <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">{post.content}</p>}

              {post.media && post.media.length > 0 && (
                <MediaPreview media={post.media} className="mb-3" />
              )}

              <div className="flex items-center gap-4 pt-2 border-t border-king-50 dark:border-surface-dark-border">
                <button
                  onClick={() => handleLike(post.id, !!hasLiked)}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${hasLiked ? 'text-error-500' : 'text-gray-500 dark:text-gray-400 hover:text-error-500'}`}
                >
                  <Heart className={`w-4 h-4 ${hasLiked ? 'fill-current' : ''}`} />
                  {likeCount > 0 && likeCount}
                </button>
                <button
                  onClick={() => onNavigate('post-detail', { postId: post.id })}
                  className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-king-500 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  {commentCount > 0 && commentCount}
                </button>
                <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <Eye className="w-4 h-4" /> {post.view_count || 0}
                </span>
                <button
                  onClick={() => handleShare(post.id)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-king-500 transition-colors ml-auto"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })
      )}

      {sharePostId && (
        <SharePostModal
          postId={sharePostId}
          profile={profile}
          onClose={() => setSharePostId(null)}
          onNavigate={onNavigate}
        />
      )}

      {/* Create Post Modal */}
      {showCreatePost && (
        <CreatePostModal
          onClose={() => { setShowCreatePost(false); fetchPosts(); }}
          profile={profile}
        />
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => { setEditingPost(null); fetchPosts(); }}
        />
      )}

      {/* Create Story Modal */}
      {showCreateStory && (
        <CreateStoryModal
          onClose={() => { setShowCreateStory(false); fetchStories(); }}
          profile={profile}
        />
      )}

      {/* Story Viewer */}
      {viewingStory && (
        <StoryViewer
          story={viewingStory}
          allStories={stories}
          startIndex={stories.findIndex((s) => s.id === viewingStory.id)}
          onClose={() => setViewingStory(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

function EditPostModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { t } = useLang();
  const [content, setContent] = useState(post.content || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('posts').update({ content: content.trim() }).eq('id', post.id);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-lg p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('editPost')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} className="input-field resize-none mb-4" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? t('loading') : t('saveChanges')}</button>
        </div>
      </div>
    </div>
  );
}

function CreatePostModal({ onClose, profile }: { onClose: () => void; profile: Profile | null }) {
  const { t } = useLang();
  const [content, setContent] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItemWithEdit[]>([]);
  const [audience, setAudience] = useState<'public' | 'friends' | 'private'>('public');
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [studioIndex, setStudioIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'carousel' | 'list' | 'single'>('grid');
  const [portfolioFolders, setPortfolioFolders] = useState<PortfolioFolder[]>([]);
  const [portfolioFolderId, setPortfolioFolderId] = useState<string>('');

  useEffect(() => {
    if (!profile) return;
    supabase.from('portfolio_folders').select('*').eq('user_id', profile.id).order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setPortfolioFolders(data as PortfolioFolder[]); });
  }, [profile]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !profile) return;
    setUploading(true);
    const items: MediaItemWithEdit[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const filePath = `${profile.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.MEDIA).upload(filePath, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKETS.MEDIA).getPublicUrl(filePath);
        items.push({ type: getFileType(file.name), url: publicUrl, name: file.name, size: file.size, edit: { ...DEFAULT_EDIT } });
      }
    }
    setMediaItems([...mediaItems, ...items]);
    setUploading(false);
  };

  const handleApplyStudio = (edit: StudioEdit) => {
    if (studioIndex === null) return;
    setMediaItems((prev) => prev.map((item, i) => i === studioIndex ? { ...item, edit } : item));
    setStudioIndex(null);
  };

  const removeMediaItem = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!profile) return;
    if (!content.trim() && mediaItems.length === 0) return;
    if (portfolioFolderId) {
      const { data: folder } = await supabase.from('portfolio_folders').select('*').eq('id', portfolioFolderId).maybeSingle();
      if (folder) {
        const existingMedia = (folder.media as MediaItem[]) || [];
        const newMedia: MediaItem[] = mediaItems.map((m) => ({ type: m.type, url: m.url, name: m.name, size: m.size }));
        await supabase.from('portfolio_folders').update({ media: [...existingMedia, ...newMedia] }).eq('id', portfolioFolderId);
      }
    }
    await supabase.from('posts').insert({
      user_id: profile.id,
      content: content.trim(),
      media: mediaItems,
      audience,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-lg p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('createPost')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Avatar user={profile} size="sm" showVerified showAdmin />
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as 'public' | 'friends' | 'private')}
            className="text-xs bg-king-50 dark:bg-surface-dark-alt border border-king-200 dark:border-surface-dark-border rounded-lg px-2 py-1 text-gray-600 dark:text-gray-400"
          >
            <option value="public">{t('public')}</option>
            <option value="friends">{t('friendsAudience')}</option>
            <option value="private">{t('private')}</option>
          </select>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setShowPreview(false)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${!showPreview ? 'bg-king-100 text-king-600 dark:bg-surface-dark-alt dark:text-king-400' : 'text-gray-400'}`}
            >
              <Edit2 className="w-3 h-3" /> {t('editMode')}
            </button>
            <button
              onClick={() => setShowPreview(true)}
              disabled={!content.trim() && mediaItems.length === 0}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors disabled:opacity-30 ${showPreview ? 'bg-king-100 text-king-600 dark:bg-surface-dark-alt dark:text-king-400' : 'text-gray-400'}`}
            >
              <Eye className="w-3 h-3" /> {t('previewMode')}
            </button>
          </div>
        </div>

        {showPreview ? (
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">{t('postPreview')}</p>
            <div className="card p-4 border border-king-100 dark:border-surface-dark-border">
              <div className="flex items-center gap-2 mb-3">
                <Avatar user={profile} size="sm" showVerified showAdmin />
                <div>
                  <span className="text-sm font-medium">{getDisplayName(profile)}</span>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    {audience === 'public' ? <Globe className="w-3 h-3" /> : audience === 'friends' ? <Users className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {t('justNow') || 'now'}
                  </p>
                </div>
              </div>
              {content.trim() && <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">{content}</p>}
              {mediaItems.length > 0 && <MediaPreview media={mediaItems} viewMode={viewMode} onViewModeChange={setViewMode} showViewToggle className="mb-3" />}
              <div className="flex items-center gap-4 pt-2 border-t border-king-50 dark:border-surface-dark-border">
                <span className="flex items-center gap-1.5 text-sm text-gray-400"><Heart className="w-4 h-4" /> 0</span>
                <span className="flex items-center gap-1.5 text-sm text-gray-400"><MessageCircle className="w-4 h-4" /> 0</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('whatsOnYourMind')}
              rows={4}
              className="input-field resize-none mb-3"
            />

            {mediaItems.length > 0 && (
              <div className="mb-3">
                <MediaPreview media={mediaItems} viewMode={viewMode} onViewModeChange={setViewMode} showViewToggle />
                <div className="flex flex-wrap gap-2 mt-2">
                  {mediaItems.map((item, index) => (item.type === 'image' || item.type === 'gif') && (
                    <button key={`${item.url}-${index}`} onClick={() => setStudioIndex(index)} className="text-xs text-king-600 dark:text-king-400 bg-king-50 dark:bg-surface-dark-alt rounded-lg px-2.5 py-1.5 hover:bg-king-100 transition-colors">
                      {t('mediaStudio')} {index + 1}
                    </button>
                  ))}
                  <button onClick={() => setMediaItems([])} className="text-xs text-error-500 px-2.5 py-1.5">{t('removeAll')}</button>
                </div>
              </div>
            )}
          </>
        )}

        {portfolioFolders.length > 0 && (
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">{t('publishToPortfolio')}</label>
            <select
              value={portfolioFolderId}
              onChange={(e) => setPortfolioFolderId(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">{t('selectFolder')}</option>
              {portfolioFolders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-king-500">
            <ImageIcon className="w-5 h-5" />
            {t('addMedia')}
            <input type="file" multiple accept="image/*,video/*,audio/*,.pdf,.gif,.svga" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
          </label>
          <button onClick={handleSubmit} disabled={uploading || (!content.trim() && mediaItems.length === 0)} className="btn-primary flex items-center gap-2">
            {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            {t('post')}
          </button>
        </div>
      </div>
      {studioIndex !== null && mediaItems[studioIndex] && (mediaItems[studioIndex].type === 'image' || mediaItems[studioIndex].type === 'gif') && (
        <MediaStudio imageUrl={mediaItems[studioIndex].url} onApply={handleApplyStudio} onClose={() => setStudioIndex(null)} />
      )}
    </div>
  );
}

const STORY_BACKGROUNDS = [
  { id: 'default', label: 'Default', style: 'bg-gradient-to-br from-king-900/80 to-king-700/60' },
  { id: 'sunset', label: 'Sunset', style: 'bg-gradient-to-br from-orange-500 to-pink-600' },
  { id: 'ocean', label: 'Ocean', style: 'bg-gradient-to-br from-cyan-500 to-blue-700' },
  { id: 'forest', label: 'Forest', style: 'bg-gradient-to-br from-green-500 to-emerald-800' },
  { id: 'purple', label: 'Purple', style: 'bg-gradient-to-br from-violet-500 to-purple-800' },
  { id: 'dark', label: 'Dark', style: 'bg-gradient-to-br from-gray-800 to-black' },
  { id: 'rose', label: 'Rose', style: 'bg-gradient-to-br from-rose-400 to-red-700' },
  { id: 'gold', label: 'Gold', style: 'bg-gradient-to-br from-amber-400 to-yellow-700' },
];

const STORY_FONTS = [
  { id: 'display', label: 'Display', class: 'font-display' },
  { id: 'sans', label: 'Sans', class: 'font-sans' },
  { id: 'serif', label: 'Serif', class: 'font-serif' },
  { id: 'mono', label: 'Mono', class: 'font-mono' },
];

const STORY_TEXT_COLORS = ['#ffffff', '#fbbf24', '#f87171', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c'];

function getStoryBgClass(bgId: string | null): string {
  const bg = STORY_BACKGROUNDS.find((b) => b.id === bgId);
  return bg ? bg.style : STORY_BACKGROUNDS[0].style;
}

function getStoryFontClass(fontId: string | null): string {
  const font = STORY_FONTS.find((f) => f.id === fontId);
  return font ? font.class : STORY_FONTS[0].class;
}

function CreateStoryModal({ onClose, profile }: { onClose: () => void; profile: Profile | null }) {
  const { t } = useLang();
  const [content, setContent] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItemWithEdit[]>([]);
  const [audience, setAudience] = useState<'public' | 'friends' | 'private'>('public');
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [background, setBackground] = useState('default');
  const [fontFamily, setFontFamily] = useState('display');
  const [textColor, setTextColor] = useState('#ffffff');
  const [showTextTools, setShowTextTools] = useState(false);
  const [studioIndex, setStudioIndex] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !profile) return;
    setUploading(true);
    const items: MediaItemWithEdit[] = [];
    for (const file of Array.from(files)) {
      const filePath = `${profile.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.MEDIA).upload(filePath, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKETS.MEDIA).getPublicUrl(filePath);
        items.push({ type: getFileType(file.name), url: publicUrl, name: file.name, size: file.size, edit: { ...DEFAULT_EDIT } });
      }
    }
    setMediaItems([...mediaItems, ...items]);
    setUploading(false);
  };

  const handleApplyStudio = (edit: StudioEdit) => {
    if (studioIndex === null) return;
    setMediaItems((prev) => prev.map((item, i) => i === studioIndex ? { ...item, edit } : item));
    setStudioIndex(null);
  };

  const handleSubmit = async () => {
    if (!profile) return;
    if (!content.trim() && mediaItems.length === 0) return;
    setPublishing(true);

    if (mediaItems.length > 1) {
      // Batch publish: each media item becomes its own story (Instagram-style)
      const inserts = mediaItems.map((item) => ({
        user_id: profile.id,
        content: content.trim(),
        media: [item],
        audience,
        background,
        font_family: fontFamily,
        text_color: textColor,
      }));
      const { error } = await supabase.from('stories').insert(inserts);
      if (error) {
        window.alert(error.message);
        setPublishing(false);
        return;
      }
    } else {
      const { error } = await supabase.from('stories').insert({
        user_id: profile.id,
        content: content.trim(),
        media: mediaItems,
        audience,
        background,
        font_family: fontFamily,
        text_color: textColor,
      });
      if (error) {
        window.alert(error.message);
        setPublishing(false);
        return;
      }
    }
    setPublishing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-md p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('createStory')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(false)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${!showPreview ? 'bg-king-100 text-king-600 dark:bg-surface-dark-alt dark:text-king-400' : 'text-gray-400'}`}
            >
              <Edit2 className="w-3 h-3" /> {t('editMode')}
            </button>
            <button
              onClick={() => setShowPreview(true)}
              disabled={!content.trim() && mediaItems.length === 0}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors disabled:opacity-30 ${showPreview ? 'bg-king-100 text-king-600 dark:bg-surface-dark-alt dark:text-king-400' : 'text-gray-400'}`}
            >
              <Eye className="w-3 h-3" /> {t('previewMode')}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {showPreview ? (
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">{t('storyPreview')}</p>
            {/* Instagram 9:16 story preview */}
            <div className={`rounded-2xl overflow-hidden ${getStoryBgClass(background)} flex flex-col items-center justify-center mx-auto`} style={{ aspectRatio: '9 / 16', maxWidth: '280px' }}>
              {mediaItems.length > 0 && <div className="w-full h-full"><MediaPreview media={mediaItems} maxDisplay={1} /></div>}
              {content.trim() && <p className={`${getStoryFontClass(fontFamily)} text-center mt-3 text-lg px-4`} style={{ color: textColor }}>{content}</p>}
              <div className="flex items-center gap-2 mt-4 pb-4">
                <Avatar user={profile} size="sm" showVerified showAdmin />
                <span className="text-white text-sm">{getDisplayName(profile)}</span>
              </div>
            </div>
            {mediaItems.length > 1 && (
              <p className="text-xs text-king-500 text-center mt-2">{mediaItems.length} {t('createStory')}</p>
            )}
          </div>
        ) : (
          <>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as 'public' | 'friends' | 'private')}
              className="input-field mb-3 text-sm"
            >
              <option value="public">{t('public')}</option>
              <option value="friends">{t('friendsAudience')}</option>
              <option value="private">{t('private')}</option>
            </select>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('whatsOnYourMind')}
              rows={3}
              className="input-field resize-none mb-3"
            />

            {content.trim() && (
              <div className="mb-3">
                <button
                  onClick={() => setShowTextTools(!showTextTools)}
                  className="flex items-center gap-1.5 text-xs text-king-600 dark:text-king-400 mb-2"
                >
                  <Palette className="w-3.5 h-3.5" /> {t('storyBackground')}
                </button>
                {showTextTools && (
                  <div className="space-y-2 bg-king-50 dark:bg-surface-dark-alt rounded-xl p-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('storyBackground')}</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {STORY_BACKGROUNDS.map((bg) => (
                          <button
                            key={bg.id}
                            onClick={() => setBackground(bg.id)}
                            className={`w-8 h-8 rounded-lg ${bg.style} ${background === bg.id ? 'ring-2 ring-king-500 ring-offset-1' : ''}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('storyFont')}</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {STORY_FONTS.map((font) => (
                          <button
                            key={font.id}
                            onClick={() => setFontFamily(font.id)}
                            className={`px-3 py-1 rounded-lg text-xs ${font.class} ${fontFamily === font.id ? 'bg-king-500 text-white' : 'bg-white dark:bg-surface-dark-card text-gray-600 dark:text-gray-300'}`}
                          >
                            {font.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('storyTextColor')}</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {STORY_TEXT_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setTextColor(color)}
                            className={`w-7 h-7 rounded-full ${textColor === color ? 'ring-2 ring-king-500 ring-offset-1' : ''}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mediaItems.length > 0 && (
              <div className="mb-3">
                {/* Instagram 9:16 story preview in edit mode */}
                <div className="rounded-xl overflow-hidden bg-black mx-auto mb-2" style={{ aspectRatio: '9 / 16', maxWidth: '200px' }}>
                  <MediaPreview media={mediaItems} maxDisplay={1} />
                </div>
                {mediaItems.length > 1 && (
                  <p className="text-xs text-king-500 text-center mb-2">{mediaItems.length} {t('createStory')} - {t('batchUploadHint')}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {mediaItems.map((item, index) => (item.type === 'image' || item.type === 'gif') && (
                    <button key={`${item.url}-${index}`} onClick={() => setStudioIndex(index)} className="text-xs text-king-600 dark:text-king-400 bg-king-50 dark:bg-surface-dark-alt rounded-lg px-2.5 py-1.5 hover:bg-king-100 transition-colors">
                      {t('mediaStudio')} {index + 1}
                    </button>
                  ))}
                  <button onClick={() => setMediaItems([])} className="text-xs text-error-500 px-2.5 py-1.5">{t('removeAll')}</button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-king-500">
            <ImageIcon className="w-5 h-5" />
            {t('addMedia')}
            <input type="file" multiple accept="image/*,video/*,audio/*,.pdf,.gif,.svga" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
          </label>
          <button onClick={handleSubmit} disabled={uploading || publishing || (!content.trim() && mediaItems.length === 0)} className="btn-primary flex items-center gap-2">
            {(uploading || publishing) ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            {publishing ? t('publishing') : (mediaItems.length > 1 ? t('publishAll') : t('share'))}
          </button>
        </div>
      </div>
      {studioIndex !== null && mediaItems[studioIndex] && (mediaItems[studioIndex].type === 'image' || mediaItems[studioIndex].type === 'gif') && (
        <MediaStudio imageUrl={mediaItems[studioIndex].url} onApply={handleApplyStudio} onClose={() => setStudioIndex(null)} />
      )}
    </div>
  );
}

function StoryViewer({ story, allStories, startIndex, onClose, onNavigate }: {
  story: Story;
  allStories: Story[];
  startIndex: number;
  onClose: () => void;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}) {
  const { profile } = useAuth();
  const { t, lang } = useLang();
  const [comment, setComment] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<{ user: Profile; created_at: string; reaction: string | null }[]>([]);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(story.content);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showStoryMenu, setShowStoryMenu] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStory = allStories[currentIndex] || story;
  const isOwner = profile?.id === currentStory.user_id;
  const elapsedMs = Date.now() - new Date(currentStory.created_at).getTime();
  const canEdit = isOwner && elapsedMs < 10 * 60 * 1000;
  const STORY_DURATION = 60;

  useEffect(() => {
    if (profile && currentStory.user_id !== profile.id) {
      supabase.from('story_views').upsert({
        story_id: currentStory.id,
        user_id: profile.id,
      });
    }
  }, [currentStory, profile]);

  // Story playback countdown timer
  useEffect(() => {
    setProgress(0);
    setIsPaused(false);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (!isPaused) {
        setProgress((p) => {
          const next = p + 100 / (STORY_DURATION * 10);
          if (next >= 100) {
            // Auto-advance to next story
            if (currentIndex < allStories.length - 1) {
              setCurrentIndex((i) => i + 1);
              return 0;
            } else {
              onClose();
              return 100;
            }
          }
          return next;
        });
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isPaused, allStories.length, onClose]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [currentIndex]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  };

  const handleNext = () => {
    if (currentIndex < allStories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const togglePause = () => {
    setIsPaused((p) => !p);
  };

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.35) {
      handlePrev();
    } else if (x > rect.width * 0.65) {
      handleNext();
    } else {
      togglePause();
    }
  };

  const fetchViewers = async () => {
    const { data } = await supabase
      .from('story_views')
      .select('user:profiles!story_views_user_id_fkey(*), created_at, reaction')
      .eq('story_id', currentStory.id)
      .order('created_at', { ascending: false });
    if (data) {
      const ordered = (data as unknown as { user: Profile; created_at: string; reaction: string | null }[])
        .sort((a, b) => Number(Boolean(b.reaction)) - Number(Boolean(a.reaction)) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setViewers(ordered);
    }
  };

  const handleComment = async () => {
    if (!profile || !comment.trim() || isOwner) return;
    const { data: commentData } = await supabase.from('comments').insert({
      story_id: currentStory.id,
      user_id: profile.id,
      content: comment.trim(),
    }).select('id').single();
    await supabase.from('notifications').insert({
      user_id: currentStory.user_id,
      actor_id: profile.id,
      type: 'comment',
      entity_type: 'story',
      entity_id: currentStory.id,
      content: comment.trim(),
    });
    setComment('');
    if (commentData) {
      setComment('');
      onClose();
    }
  };

  const handleLikeStory = async () => {
    if (!profile || isOwner) return;
    const existing = currentStory.views?.find((v) => v.user_id === profile.id);
    const newReaction = existing?.reaction === 'like' ? null : 'like';
    await supabase.from('story_views').upsert({
      story_id: currentStory.id,
      user_id: profile.id,
      reaction: newReaction,
    });
    if (newReaction === 'like') {
      await supabase.from('notifications').insert({
        user_id: currentStory.user_id,
        actor_id: profile.id,
        type: 'like',
        entity_type: 'story',
        entity_id: currentStory.id,
      });
    }
    onClose();
  };

  const handleDeleteStory = async () => {
    await supabase.from('stories').delete().eq('id', currentStory.id);
    if (currentIndex < allStories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handleEditStory = async () => {
    await supabase.from('stories').update({ content: editContent.trim() }).eq('id', currentStory.id);
    setEditing(false);
  };

  const handleReportStory = async () => {
    if (!profile) return;
    await supabase.from('reports').insert({
      reporter_id: profile.id,
      reported_user_id: currentStory.user_id,
      entity_type: 'story',
      entity_id: currentStory.id,
      reason: 'Reported from story viewer',
    });
    onClose();
  };

  const handleShareStory = async () => {
    const url = `${window.location.origin}?story=${currentStory.user?.king_id || 'king'}&story_id=${currentStory.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: getDisplayName(currentStory.user), url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-fade-in" onClick={onClose}>
      {/* Vertical 1080x1920 story container - responsive on all devices */}
      <div
        className="relative bg-black overflow-hidden flex flex-col shadow-2xl"
        style={{
          aspectRatio: '1080 / 1920',
          height: '100dvh',
          maxWidth: 'calc(100dvh * 1080 / 1920)',
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars at top */}
        <div className="absolute top-0 left-0 right-0 z-40 px-2 pt-2 flex gap-1">
          {allStories.map((_, i) => (
            <div key={i} className="story-progress-bar">
              <div
                className="story-progress-fill"
                style={{
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                  transition: i === currentIndex ? 'width 0.1s linear' : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Top gradient overlay for header readability */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent z-20 pointer-events-none" />

        {/* Header */}
        <div className={`absolute top-0 left-0 right-0 z-30 p-3 pt-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-2">
            <Avatar user={currentStory.user} size="sm" showRing showVerified showAdmin showBadges onClick={() => { onNavigate('profile', { userId: currentStory.user_id }); onClose(); }} />
            <div className="flex-1 min-w-0">
              <span
                className={`text-white text-sm font-medium block truncate ${shouldUseAnimatedName(currentStory.user) ? 'animated-name' : ''}`}
                style={getNameStyle(currentStory.user)}
              >
                {getDisplayName(currentStory.user)}
              </span>
              <p className="text-white/60 text-xs">{t('publishedAt')}: {formatTime(currentStory.created_at, lang)}</p>
            </div>
            {isOwner && (
              <button
                onClick={() => { setShowViewers(true); fetchViewers(); }}
                className="p-1.5 text-white/70 hover:text-white transition-colors"
                title={t('storyViewers')}
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white text-xs bg-white/10 rounded-full px-2.5 py-1">تخطي</button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowStoryMenu((s) => !s); }}
              className="p-1.5 text-white/70 hover:text-white transition-colors"
              title={t('more')}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showStoryMenu && (
          <div className="absolute top-14 right-3 z-50 bg-white dark:bg-surface-dark-card rounded-xl shadow-xl py-1 w-44 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {isOwner && canEdit && (
              <button onClick={() => { setEditing(true); setShowStoryMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-king-50 dark:hover:bg-surface-dark-alt transition-colors">
                <Edit2 className="w-4 h-4" /> {t('editStory')}
              </button>
            )}
            {isOwner && (
              <button onClick={() => { handleDeleteStory(); setShowStoryMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error-500 hover:bg-error-50 dark:hover:bg-surface-dark-alt transition-colors">
                <Trash2 className="w-4 h-4" /> {t('deleteStory')}
              </button>
            )}
            {!isOwner && (
              <button onClick={() => { handleReportStory(); setShowStoryMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error-500 hover:bg-error-50 dark:hover:bg-surface-dark-alt transition-colors">
                <Flag className="w-4 h-4" /> {t('report')}
              </button>
            )}
            <button onClick={() => { onNavigate('profile', { userId: currentStory.user_id }); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-king-50 dark:hover:bg-surface-dark-alt transition-colors">
              <ExternalLink className="w-4 h-4" /> {t('viewProfile')}
            </button>
            <button onClick={() => { handleShareStory(); setShowStoryMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-king-50 dark:hover:bg-surface-dark-alt transition-colors">
              <Share2 className="w-4 h-4" /> مشاركة القصة
            </button>
          </div>
        )}

        {/* Media area - fills the vertical space, with tap zones */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden"
          onClick={handleTap}
        >
          {currentStory.media && currentStory.media.length > 0 && (
            <div className="absolute inset-0">
              <MediaPreview media={currentStory.media} maxDisplay={1} autoPlayVideo onMediaEnd={() => {
                if (currentIndex < allStories.length - 1) {
                  setCurrentIndex((i) => i + 1);
                  setProgress(0);
                } else {
                  onClose();
                }
              }} />
            </div>
          )}
          {editing ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 z-10" onClick={(e) => e.stopPropagation()}>
              <div className="w-full bg-black/60 rounded-2xl p-4">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-king-400 resize-none"
                  rows={3}
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={handleEditStory} className="btn-primary flex-1 text-sm">{t('saveChanges')}</button>
                  <button onClick={() => setEditing(false)} className="btn-ghost flex-1 text-sm text-white">{t('cancel')}</button>
                </div>
              </div>
            </div>
          ) : (
            currentStory.content && (
              <div className="absolute bottom-24 left-0 right-0 flex items-end justify-center px-6 z-10">
                <p className={`${getStoryFontClass(currentStory.font_family)} text-center text-xl md:text-2xl leading-relaxed max-w-md`}
                   style={{ color: currentStory.text_color || '#ffffff' }}>
                  {currentStory.content}
                </p>
              </div>
            )
          )}

          {/* Pause indicator */}
          {isPaused && !editing && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="bg-black/40 rounded-full p-4">
                <Pause className="w-8 h-8 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent z-20 pointer-events-none" />

        {/* Story control buttons */}
        <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button onClick={handlePrev} disabled={currentIndex === 0} className="story-control-btn disabled:opacity-30">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <button onClick={togglePause} className="story-control-btn">
            {isPaused ? <Play className="w-5 h-5 text-white" /> : <Pause className="w-5 h-5 text-white" />}
          </button>
          <button onClick={handleNext} disabled={currentIndex === allStories.length - 1} className="story-control-btn disabled:opacity-30">
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Countdown indicator */}
        <div className={`absolute bottom-14 left-1/2 -translate-x-1/2 z-30 text-white/60 text-xs transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {Math.ceil((100 - progress) / 100 * STORY_DURATION)} {t('secondsRemaining')}
        </div>

        {/* Owner controls: edit/delete within 10 minutes */}
        {isOwner && canEdit && !editing && (
          <div className={`absolute bottom-4 left-4 right-4 z-30 flex gap-2 justify-center transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm text-white/90 hover:text-white bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 transition-colors">
              <Edit2 className="w-4 h-4" /> {t('editStory')}
            </button>
            <button onClick={handleDeleteStory} className="flex items-center gap-1.5 text-sm text-error-400 hover:text-error-300 bg-error-500/20 backdrop-blur-sm rounded-xl px-3 py-2 transition-colors">
              <Trash2 className="w-4 h-4" /> {t('deleteStory')}
            </button>
          </div>
        )}
        {isOwner && !canEdit && !editing && (
          <p className={`absolute bottom-4 left-0 right-0 z-30 text-xs text-white/40 text-center transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>{t('editWindowExpired')}</p>
        )}

        {/* Comment + Like: only for non-owners */}
        {profile && !isOwner && (
          <div className="absolute bottom-4 left-4 right-4 z-30 flex gap-2 items-center">
            <button
              onClick={async (e) => {
                e.stopPropagation();
                handleLikeStory();
              }}
              className={`rounded-full p-2.5 transition-colors flex-shrink-0 ${currentStory.views?.some((v) => v.user_id === profile.id && v.reaction === 'like') ? 'bg-error-500 text-white' : 'bg-white/10 backdrop-blur-sm text-white/70 hover:text-white'}`}
            >
              <Heart className={`w-4 h-4 ${currentStory.views?.some((v) => v.user_id === profile.id && v.reaction === 'like') ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleReportStory(); }}
              className="bg-white/10 backdrop-blur-sm text-white/70 hover:text-white rounded-full p-2.5 transition-colors flex-shrink-0"
              title={t('report')}
            >
              <Flag className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              placeholder={t('replyToStory')}
              className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-king-400 text-sm"
            />
            <button onClick={handleComment} className="bg-king-500 hover:bg-king-600 text-white rounded-full p-2.5 transition-colors flex-shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Viewers list modal */}
        {showViewers && (
          <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowViewers(false)}>
            <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-sm max-h-[70%] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-gray-900 dark:text-king-50">{t('storyViewers')}</h3>
                <button onClick={() => setShowViewers(false)} className="p-1 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              {viewers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{t('noViewers')}</p>
              ) : (
                <div className="space-y-2">
                  {viewers.map((v) => (
                    <div
                      key={v.user.id}
                      className="flex items-center gap-3 p-2 hover:bg-king-50 dark:hover:bg-surface-dark-alt rounded-xl cursor-pointer"
                      onClick={() => { onNavigate('profile', { userId: v.user.id }); setShowViewers(false); onClose(); }}
                    >
                      <Avatar user={v.user} size="sm" showRing showVerified showAdmin showBadges />
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm font-medium text-gray-900 dark:text-king-50 ${shouldUseAnimatedName(v.user) ? 'animated-name' : ''}`}
                          style={getNameStyle(v.user)}
                        >
                          {getDisplayName(v.user)}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('id')}: {v.user.king_id}</p>
                        <p className="text-xs text-king-500 dark:text-king-400">{t('viewedAt')}: {formatTime(v.created_at, lang)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SharePostModal({ postId, profile, onClose, onNavigate }: {
  postId: string;
  profile: Profile | null;
  onClose: () => void;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}) {
  const { t, lang } = useLang();
  const [copied, setCopied] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friends, setFriends] = useState<Profile[]>([]);
  const url = `${window.location.origin}?post=${profile?.king_id || 'king'}&post_id=${postId}`;

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('friendships')
      .select('receiver:profiles!friendships_receiver_id_fkey(*), requester:profiles!friendships_requester_id_fkey(*)')
      .or(`requester_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .eq('status', 'accepted')
      .then(({ data }) => {
        if (!data) return;
        const list: Profile[] = [];
        for (const f of (data as unknown as { receiver: Profile; requester: Profile }[])) {
          const other = f.receiver.id === profile.id ? f.requester : f.receiver;
          list.push(other);
        }
        setFriends(list);
      });
  }, [profile]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExternalShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: t('sharePost'), url }); } catch { /* cancelled */ }
    } else { handleCopy(); }
  };

  const handleShareToStory = async () => {
    if (!profile) return;
    const { data: post } = await supabase.from('posts').select('*').eq('id', postId).maybeSingle();
    if (!post) return;
    await supabase.from('stories').insert({
      user_id: profile.id, content: post.content || '', media: post.media || [],
      audience: 'public', background: 'default', font_family: 'display', text_color: '#ffffff',
    });
    onClose();
  };

  const handleSendToFriend = async (friendId: string) => {
    const { data: conv } = await supabase
      .from('conversations').select('id')
      .or(`and(user1_id.eq.${profile?.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${profile?.id})`)
      .maybeSingle();
    let conversationId = conv?.id;
    if (!conversationId) {
      const { data: newConv } = await supabase.from('conversations').insert({
        user1_id: profile?.id, user2_id: friendId,
      }).select('id').single();
      conversationId = newConv?.id;
    }
    if (conversationId) {
      await supabase.from('messages').insert({
        conversation_id: conversationId, sender_id: profile?.id, content: url,
      });
    }
    onClose();
    onNavigate('messages', { userId: friendId });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-sm p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50">{t('sharePost')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {!showFriendPicker ? (
          <div className="space-y-2">
            <button onClick={handleShareToStory} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-king-50 dark:hover:bg-surface-dark-alt transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-king-400 to-king-600 flex items-center justify-center text-white">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('shareToStory')}</span>
            </button>
            <button onClick={() => setShowFriendPicker(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-king-50 dark:hover:bg-surface-dark-alt transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center text-white">
                <MessageCircle className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('shareToFriend')}</span>
            </button>
            <button onClick={handleCopy} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-king-50 dark:hover:bg-surface-dark-alt transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white">
                <Copy className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{copied ? t('linkCopied') : t('copyLink')}</span>
            </button>
            <button onClick={handleExternalShare} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-king-50 dark:hover:bg-surface-dark-alt transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
                <ExternalLink className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('shareExternal')}</span>
            </button>
          </div>
        ) : (
          <div>
            <button onClick={() => setShowFriendPicker(false)} className="text-xs text-king-500 mb-3 flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> {lang === 'ar' ? 'رجوع' : 'Back'}
            </button>
            {friends.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">{t('noFriends')}</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {friends.map((f) => (
                  <button key={f.id} onClick={() => handleSendToFriend(f.id)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-king-50 dark:hover:bg-surface-dark-alt transition-colors">
                    <Avatar user={f} size="sm" showVerified showAdmin />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{getDisplayName(f)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
