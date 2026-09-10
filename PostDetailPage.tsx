import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Heart, Share2, Trash2, Flag, Send, MoreHorizontal, Globe, Users, Lock, X, AtSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import { Avatar } from '@/components/Avatar';
import { MediaPreview } from '@/components/MediaPreview';
import { getDisplayName, getNameColor, formatTime } from '@/lib/helpers';
import type { Post, Comment, Profile } from '@/types';

interface PostDetailPageProps {
  postId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function PostDetailPage({ postId, onNavigate }: PostDetailPageProps) {
  const { profile } = useAuth();
  const { t } = useLang();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<(Comment & { user: Profile; replies?: (Comment & { user: Profile })[] })[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const [reactors, setReactors] = useState<Profile[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'carousel' | 'list' | 'single'>('grid');

  const fetchPost = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        user:profiles!posts_user_id_fkey(*),
        likes(user_id)
      `)
      .eq('id', postId)
      .maybeSingle();
    if (data) setPost(data as Post);
  }, [postId]);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('comments')
      .select(`*, user:profiles!comments_user_id_fkey(*)`)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (data) {
      const topLevel = (data as (Comment & { user: Profile })[]).filter((c) => !c.parent_id);
      const withReplies = topLevel.map((c) => ({
        ...c,
        replies: (data as (Comment & { user: Profile })[]).filter((r) => r.parent_id === c.id),
      }));
      setComments(withReplies);
    }
  }, [postId]);

  useEffect(() => {
    Promise.all([fetchPost(), fetchComments()]).finally(() => setLoading(false));
  }, [fetchPost, fetchComments]);

  const handleLike = async () => {
    if (!profile || !post) return;
    const hasLiked = post.likes?.some((l) => l.user_id === profile.id);
    if (hasLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', profile.id);
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: profile.id });
      if (post.user_id !== profile.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: profile.id,
          type: 'like',
          entity_type: 'post',
          entity_id: post.id,
        });
      }
    }
    fetchPost();
  };

  const handleComment = async () => {
    if (!profile || !post || !commentText.trim()) return;
    await supabase.from('comments').insert({
      post_id: post.id,
      user_id: profile.id,
      content: commentText.trim(),
    });
    if (post.user_id !== profile.id) {
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        actor_id: profile.id,
        type: 'comment',
        entity_type: 'post',
        entity_id: post.id,
      });
    }
    setCommentText('');
    fetchComments();
  };

  const handleReply = async (parentId: string) => {
    if (!profile || !post || !replyText.trim()) return;
    await supabase.from('comments').insert({
      post_id: post.id,
      user_id: profile.id,
      content: replyText.trim(),
      parent_id: parentId,
    });
    const parentComment = comments.find((c) => c.id === parentId);
    if (parentComment && parentComment.user_id !== profile.id) {
      await supabase.from('notifications').insert({
        user_id: parentComment.user_id,
        actor_id: profile.id,
        type: 'comment',
        entity_type: 'post',
        entity_id: post.id,
      });
    }
    setReplyTo(null);
    setReplyText('');
    fetchComments();
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId);
    fetchComments();
  };

  const handleShare = async () => {
    const url = `${window.location.origin}?post=${post?.user?.king_id || 'king'}&post_id=${post?.id}`;
    await navigator.clipboard.writeText(url);
  };

  const handleReport = async () => {
    if (!profile || !post) return;
    await supabase.from('reports').insert({
      reporter_id: profile.id,
      reported_user_id: post.user_id,
      entity_type: 'post',
      entity_id: post.id,
      reason: 'Reported from post detail',
    });
  };

  const fetchReactors = async () => {
    if (!post) return;
    const { data } = await supabase
      .from('likes')
      .select('user:profiles!likes_user_id_fkey(*)')
      .eq('post_id', post.id);
    if (data) setReactors((data as unknown as { user: Profile }[]).map((r) => r.user));
  };

  if (loading) {
    return (
      <div className="card p-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full shimmer-bg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 shimmer-bg rounded" />
            <div className="h-3 w-20 shimmer-bg rounded" />
          </div>
        </div>
        <div className="h-32 mt-4 shimmer-bg rounded-xl" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">{t('noPostsYet')}</p>
        <button onClick={() => onNavigate('home')} className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          {t('backToFeed')}
        </button>
      </div>
    );
  }

  const hasLiked = post.likes?.some((l) => l.user_id === profile?.id);
  const likeCount = post.likes?.length || 0;
  const nameColor = getNameColor(post.user);
  const isOwn = post.user_id === profile?.id;
  const audienceIcon = post.audience === 'public' ? <Globe className="w-3.5 h-3.5" /> : post.audience === 'friends' ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />;

  return (
    <div className="space-y-4">
      <button onClick={() => onNavigate('home')} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-king-500 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        {t('backToFeed')}
      </button>

      <div className="card p-4 animate-slide-up">
        <div className="flex items-start gap-3 mb-3">
          <Avatar user={post.user} size="md" showVerified showAdmin onClick={() => onNavigate('profile', { userId: post.user_id })} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm" style={nameColor ? { color: nameColor } : undefined}>
                {getDisplayName(post.user)}
              </span>
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
              {!isOwn && (
                <button onClick={handleReport} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-king-50 dark:hover:bg-surface-dark-alt">
                  <Flag className="w-4 h-4" /> {t('report')}
                </button>
              )}
              <button onClick={handleShare} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-king-50 dark:hover:bg-surface-dark-alt">
                <Share2 className="w-4 h-4" /> {t('copyLink')}
              </button>
            </div>
          </div>
        </div>

        {post.content && <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">{post.content}</p>}

        {post.media && post.media.length > 0 && (
          <MediaPreview media={post.media} className="mb-3" viewMode={viewMode} onViewModeChange={setViewMode} showViewToggle />
        )}

        <div className="flex items-center gap-4 pt-2 border-t border-king-50 dark:border-surface-dark-border">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-sm transition-colors ${hasLiked ? 'text-error-500' : 'text-gray-500 dark:text-gray-400 hover:text-error-500'}`}
          >
            <Heart className={`w-4 h-4 ${hasLiked ? 'fill-current' : ''}`} />
            {likeCount > 0 && likeCount}
          </button>
          <button
            onClick={() => { setShowReactions(true); fetchReactors(); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-king-500 transition-colors"
          >
            <Heart className="w-4 h-4" />
            {t('reactors')}
          </button>
          <button onClick={handleShare} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-king-500 transition-colors ml-auto">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comments Section */}
      <div className="card p-4">
        <h3 className="font-display font-bold text-sm text-gray-900 dark:text-king-50 mb-4">
          {t('comments')} ({comments.length})
        </h3>

        {/* Comment Input */}
        {profile && (
          <div className="flex gap-2 mb-4">
            <Avatar user={profile} size="sm" />
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                placeholder={t('writeComment')}
                className="input-field flex-1"
              />
              <button onClick={handleComment} disabled={!commentText.trim()} className="btn-primary p-2">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{t('noComments')}</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const commentNameColor = getNameColor(comment.user);
              const isCommentOwn = comment.user_id === profile?.id;
              return (
                <div key={comment.id} className="space-y-2">
                  <div className="flex gap-2">
                    <Avatar user={comment.user} size="sm" onClick={() => onNavigate('profile', { userId: comment.user_id })} />
                    <div className="flex-1 min-w-0">
                      <div className="bg-king-50 dark:bg-surface-dark-alt rounded-xl px-3 py-2">
                        <span className="font-medium text-xs" style={commentNameColor ? { color: commentNameColor } : undefined}>
                          {getDisplayName(comment.user)}
                        </span>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 px-3">
                        <span className="text-xs text-gray-400">{formatTime(comment.created_at)}</span>
                        <button
                          onClick={() => {
                            setReplyTo(replyTo === comment.id ? null : comment.id);
                            setReplyText(`@${comment.user?.king_id || comment.user?.username || getDisplayName(comment.user)} `);
                          }}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-king-500"
                        >
                          {t('reply')}
                        </button>
                        {isCommentOwn && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-error-500"
                          >
                            {t('delete')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reply Input with @mention */}
                  {replyTo === comment.id && profile && (
                    <div className="flex gap-2 ml-10">
                      <Avatar user={profile} size="sm" />
                      <div className="flex-1 flex gap-2">
                        <div className="flex-1 flex items-center gap-1.5 input-field pl-2">
                          <AtSign className="w-3.5 h-3.5 text-king-500 flex-shrink-0" />
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleReply(comment.id)}
                            placeholder={t('writeComment')}
                            className="flex-1 bg-transparent border-none focus:outline-none text-sm"
                            autoFocus
                          />
                        </div>
                        <button onClick={() => handleReply(comment.id)} disabled={!replyText.trim()} className="btn-primary p-2">
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-10 space-y-2">
                      {comment.replies.map((reply) => {
                        const replyNameColor = getNameColor(reply.user);
                        const isReplyOwn = reply.user_id === profile?.id;
                        return (
                          <div key={reply.id} className="flex gap-2">
                            <Avatar user={reply.user} size="sm" onClick={() => onNavigate('profile', { userId: reply.user_id })} />
                            <div className="flex-1 min-w-0">
                              <div className="bg-king-50 dark:bg-surface-dark-alt rounded-xl px-3 py-2">
                                <span className="font-medium text-xs" style={replyNameColor ? { color: replyNameColor } : undefined}>
                                  {getDisplayName(reply.user)}
                                </span>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-wrap">
                                  {reply.content}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 mt-1 px-3">
                                <span className="text-xs text-gray-400">{formatTime(reply.created_at)}</span>
                                {isReplyOwn && (
                                  <button
                                    onClick={() => handleDeleteComment(reply.id)}
                                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-error-500"
                                  >
                                    {t('delete')}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reactors Modal */}
      {showReactions && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowReactions(false)}>
          <div className="bg-white dark:bg-surface-dark-card rounded-2xl w-full max-w-sm max-h-[70vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-king-100 dark:border-surface-dark-border sticky top-0 bg-white dark:bg-surface-dark-card z-10">
              <h2 className="font-display font-bold text-sm text-gray-900 dark:text-king-50">{t('reactors')} ({reactors.length})</h2>
              <button onClick={() => setShowReactions(false)} className="p-1.5 hover:bg-king-100 dark:hover:bg-surface-dark-alt rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {reactors.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">{t('noReactions')}</p>
            ) : (
              <div className="p-2 space-y-1">
                {reactors.map((reactor) => (
                  <div
                    key={reactor.id}
                    className="flex items-center gap-3 p-2 hover:bg-king-50 dark:hover:bg-surface-dark-alt rounded-xl cursor-pointer"
                    onClick={() => { onNavigate('profile', { userId: reactor.id }); setShowReactions(false); }}
                  >
                    <Avatar user={reactor} size="sm" showVerified showAdmin />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate">{getDisplayName(reactor)}</span>
                      <span className="text-xs text-gray-400">{t('id')}: {reactor.king_id}</span>
                    </div>
                    <Heart className="w-4 h-4 text-error-500 fill-current flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
