import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Check, X, MessageSquare, UserCheck, Users, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import { Avatar } from '@/components/Avatar';
import { getDisplayName, getNameColor, formatTime } from '@/lib/helpers';
import type { Profile, Friendship } from '@/types';

interface FriendsPageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function FriendsPage({ onNavigate }: FriendsPageProps) {
  const { profile } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState<'friends' | 'requests' | 'suggestions'>('friends');
  const [friends, setFriends] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<(Friendship & { requester: Profile })[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), receiver:profiles!friendships_receiver_id_fkey(*)')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${profile.id},receiver_id.eq.${profile.id}`);

    if (data) {
      const friendList = data.map((f) => f.requester_id === profile.id ? f.receiver : f.requester) as Profile[];
      setFriends(friendList);
    }
  }, [profile]);

  const fetchRequests = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*)')
      .eq('receiver_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (data) setRequests(data as (Friendship & { requester: Profile })[]);
  }, [profile]);

  const fetchSuggestions = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', profile.id)
      .limit(20);
    if (data) {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, receiver_id')
        .or(`requester_id.eq.${profile.id},receiver_id.eq.${profile.id}`);
      const friendIds = new Set<string>();
      (friendships || []).forEach((f) => {
        friendIds.add(f.requester_id);
        friendIds.add(f.receiver_id);
      });
      setSuggestions((data as Profile[]).filter((p) => !friendIds.has(p.id)));
    }
  }, [profile]);

  useEffect(() => {
    Promise.all([fetchFriends(), fetchRequests(), fetchSuggestions()]).finally(() => setLoading(false));
  }, [fetchFriends, fetchRequests, fetchSuggestions]);

  const handleAccept = async (friendshipId: string, requesterId: string) => {
    if (!profile) return;
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    await supabase.from('notifications').insert({
      user_id: requesterId,
      actor_id: profile.id,
      type: 'friend_accept',
      entity_type: 'user',
      entity_id: profile.id,
    });
    fetchRequests();
    fetchFriends();
  };

  const handleReject = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    fetchRequests();
  };

  const handleSendRequest = async (userId: string) => {
    if (!profile) return;
    await supabase.from('friendships').insert({
      requester_id: profile.id,
      receiver_id: userId,
      status: 'pending',
    });
    await supabase.from('notifications').insert({
      user_id: userId,
      actor_id: profile.id,
      type: 'friend_request',
      entity_type: 'user',
      entity_id: profile.id,
    });
    fetchSuggestions();
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card p-4 shimmer-bg h-16" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-king-50">{t('friends')}</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'friends', label: t('myFriends'), icon: <UserCheck className="w-4 h-4" />, count: friends.length },
          { id: 'requests', label: t('requests'), icon: <UserPlus className="w-4 h-4" />, count: requests.length },
          { id: 'suggestions', label: t('suggestions'), icon: <Users className="w-4 h-4" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id ? 'bg-king-500 text-white' : 'btn-secondary'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`text-xs px-1.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-king-200 dark:bg-surface-dark-border'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'friends' && (
        <div className="grid gap-3 md:grid-cols-2">
          {friends.length === 0 ? (
            <div className="card p-8 text-center text-gray-500 dark:text-gray-400 col-span-2">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>{t('noFriends')}</p>
            </div>
          ) : (
            friends.map((friend) => {
              const nameColor = getNameColor(friend);
              return (
                <div key={friend.id} className="card p-3 flex items-center gap-3">
                  <Avatar user={friend} size="md" showVerified showAdmin onClick={() => onNavigate('profile', { userId: friend.id })} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={nameColor ? { color: nameColor } : undefined} onClick={() => onNavigate('profile', { userId: friend.id })}>
                      {getDisplayName(friend)}
                    </p>
                    <p className="text-xs text-gray-500">{t('id')}: {friend.king_id}</p>
                  </div>
                  <button onClick={() => onNavigate('messages', { userId: friend.id })} className="btn-ghost p-2">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
              <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>{t('noPendingRequests')}</p>
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="card p-3 flex items-center gap-3">
                <Avatar user={req.requester} size="md" showVerified showAdmin onClick={() => onNavigate('profile', { userId: req.requester.id })} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{getDisplayName(req.requester)}</p>
                  <p className="text-xs text-gray-500">{t('id')}: {req.requester.king_id} · {formatTime(req.created_at)}</p>
                </div>
                <button onClick={() => handleAccept(req.id, req.requester_id)} className="btn-primary p-2">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => handleReject(req.id)} className="btn-ghost p-2 text-error-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'suggestions' && (
        <div className="grid gap-3 md:grid-cols-2">
          {suggestions.length === 0 ? (
            <div className="card p-8 text-center text-gray-500 dark:text-gray-400 col-span-2">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>{t('noSuggestions')}</p>
            </div>
          ) : (
            suggestions.map((sug) => {
              const nameColor = getNameColor(sug);
              return (
                <div key={sug.id} className="card p-3 flex items-center gap-3">
                  <Avatar user={sug} size="md" showVerified showAdmin onClick={() => onNavigate('profile', { userId: sug.id })} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={nameColor ? { color: nameColor } : undefined}>{getDisplayName(sug)}</p>
                    <p className="text-xs text-gray-500">{t('id')}: {sug.king_id}</p>
                  </div>
                  <button onClick={() => handleSendRequest(sug.id)} className="btn-primary text-sm flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5" /> {t('add')}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
