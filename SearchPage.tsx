import { useState, useEffect, useCallback } from 'react';
import { Search, Hash, UserPlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/Avatar';
import { useLang } from '@/contexts/LanguageContext';
import { getDisplayName, getNameColor, getRankName, formatTime } from '@/lib/helpers';
import type { Profile, Post } from '@/types';

interface SearchPageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function SearchPage({ onNavigate }: SearchPageProps) {
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [hashtagPosts, setHashtagPosts] = useState<(Post & { user: Profile })[]>([]);
  const [loading, setLoading] = useState(false);
  const [designersOnly, setDesignersOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'people' | 'hashtags'>('people');

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setHashtagPosts([]);
      return;
    }
    setLoading(true);

    const trimmed = query.trim();
    const isHashtag = trimmed.startsWith('#');

    if (isHashtag || activeTab === 'hashtags') {
      const tag = isHashtag ? trimmed.slice(1) : trimmed;
      const { data: postData } = await supabase
        .from('posts')
        .select('*, user:profiles!posts_user_id_fkey(*), likes(user_id), comments(id)')
        .ilike('content', `%#${tag}%`)
        .order('created_at', { ascending: false })
        .limit(30);
      setHashtagPosts((postData as (Post & { user: Profile })[]) || []);
      setResults([]);
    } else {
      const numericQuery = parseInt(trimmed);
      let q = supabase.from('profiles').select('*');

      if (!isNaN(numericQuery)) {
        q = q.eq('king_id', numericQuery);
      } else {
        q = q.or(`display_name.ilike.%${trimmed}%,username.ilike.%${trimmed}%`);
      }

      if (designersOnly) q = q.eq('account_type', 'designer');
      q = q.limit(30);

      const { data } = await q;
      setResults((data as Profile[]) || []);
      setHashtagPosts([]);
    }

    setLoading(false);
  }, [query, designersOnly, activeTab]);

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  const isHashtagQuery = query.trim().startsWith('#');

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-king-50">{t('search')}</h1>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchHashtag')}
            className="input-field pl-10"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {!isHashtagQuery && (
          <button
            onClick={() => setDesignersOnly(!designersOnly)}
            className={designersOnly ? 'btn-primary text-sm whitespace-nowrap' : 'btn-secondary text-sm whitespace-nowrap'}
          >
            {t('designers')}
          </button>
        )}
      </div>

      {/* Tab toggle for people vs hashtags when query doesn't start with # */}
      {!isHashtagQuery && query.trim() && (
        <div className="flex gap-2 bg-king-50 dark:bg-surface-dark-alt rounded-xl p-1">
          <button
            onClick={() => setActiveTab('people')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'people' ? 'bg-white dark:bg-surface-dark-card shadow-sm text-king-600 dark:text-king-400' : 'text-gray-500'}`}
          >
            {t('users')}
          </button>
          <button
            onClick={() => setActiveTab('hashtags')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'hashtags' ? 'bg-white dark:bg-surface-dark-card shadow-sm text-king-600 dark:text-king-400' : 'text-gray-500'}`}
          >
            <Hash className="w-3 h-3" />
            {t('posts')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card p-4 shimmer-bg h-16" />)}</div>
      ) : activeTab === 'hashtags' || isHashtagQuery ? (
        hashtagPosts.length === 0 ? (
          <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
            <Hash className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>{query ? t('noResults') : t('startSearching')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('hashtagResults')}</p>
            {hashtagPosts.map((post) => {
              const nameColor = getNameColor(post.user);
              return (
                <div key={post.id} className="card p-4 cursor-pointer" onClick={() => onNavigate('post-detail', { postId: post.id })}>
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar user={post.user} size="sm" showVerified showAdmin onClick={() => onNavigate('profile', { userId: post.user_id })} />
                    <span className="text-sm font-medium" style={nameColor ? { color: nameColor } : undefined}>
                      {getDisplayName(post.user)}
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(post.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{post.content}</p>
                </div>
              );
            })}
          </div>
        )
      ) : results.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          <Search className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>{query ? t('noResults') : t('startSearching')}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {results.map((user) => {
            const nameColor = getNameColor(user);
            return (
              <div key={user.id} className="card p-3 flex items-center gap-3">
                <Avatar user={user} size="md" showVerified showAdmin onClick={() => onNavigate('profile', { userId: user.id })} />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onNavigate('profile', { userId: user.id })}>
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium truncate" style={nameColor ? { color: nameColor } : undefined}>
                      {getDisplayName(user)}
                    </p>
                    {user.is_admin && (
                      <span className="badge bg-king-600 text-white text-[10px] px-1.5 py-0.5">{t('adminBadge')}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{t('id')}: {user.king_id}</p>
                  {user.account_type === 'designer' && user.designer_rank > 0 && (
                    <p className="text-xs text-king-500">{getRankName(user.designer_rank)}</p>
                  )}
                </div>
                <button onClick={() => onNavigate('profile', { userId: user.id })} className="btn-secondary text-sm">
                  {t('view')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
