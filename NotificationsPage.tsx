import { useState, useEffect, useCallback } from 'react';
import { Bell, Heart, MessageCircle, UserPlus, UserCheck, MessageSquare, Shield, Award, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import { Avatar } from '@/components/Avatar';
import { getDisplayName, getNameColor, formatTime } from '@/lib/helpers';
import type { Notification, Profile } from '@/types';

interface NotificationsPageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function NotificationsPage({ onNavigate }: NotificationsPageProps) {
  const { profile } = useAuth();
  const { t } = useLang();
  const [notifications, setNotifications] = useState<(Notification & { actor: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(*)')
      .eq('user_id', profile.id)
      .neq('type', 'message')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setNotifications(data as (Notification & { actor: Profile | null })[]);
  }, [profile]);

  useEffect(() => {
    fetchNotifications().finally(() => setLoading(false));
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false).neq('type', 'message');
    fetchNotifications();
  };

  const handleClick = (notif: Notification & { actor: Profile | null }) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.entity_type === 'post') onNavigate('home');
    else if (notif.entity_type === 'user' && notif.actor) onNavigate('profile', { userId: notif.actor.id });
    else if (notif.entity_type === 'message') onNavigate('messages', { userId: notif.actor?.id || '' });
    else onNavigate('home');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-error-500" />;
      case 'comment':
      case 'reply': return <MessageCircle className="w-4 h-4 text-king-500" />;
      case 'friend_request': return <UserPlus className="w-4 h-4 text-king-500" />;
      case 'friend_accept': return <UserCheck className="w-4 h-4 text-success-500" />;
      case 'message': return <MessageSquare className="w-4 h-4 text-king-500" />;
      case 'admin_notification':
      case 'report_reply':
      case 'ban':
      case 'unban': return <Shield className="w-4 h-4 text-accent-500" />;
      case 'reward':
      case 'vip_updated':
      case 'pro_updated':
      case 'rank_updated': return <Award className="w-4 h-4 text-king-500" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  const getNotificationText = (type: string): string => {
    const texts: Record<string, string> = {
      like: t('likedYourPost'),
      comment: t('commentedOnYourPost'),
      reply: t('repliedToComment'),
      friend_request: t('sentFriendRequest'),
      friend_accept: t('acceptedFriendRequest'),
      message: t('sentYouMessage'),
      reward: t('sentYouReward'),
      vip_updated: t('updatedVip'),
      pro_updated: t('updatedPro'),
      rank_updated: t('updatedRank'),
      ban: t('accountBanned'),
      unban: t('accountUnbanned'),
      verification_approved: t('verificationApproved'),
      verification_rejected: t('verificationRejected'),
    };
    return texts[type] || t('sentYouMessage');
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card p-4 shimmer-bg h-16" />)}</div>;
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-king-50">{t('notifications')}</h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-1.5">
            <Check className="w-4 h-4" /> {t('markAllRead')}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>{t('noNotifications')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const nameColor = getNameColor(notif.actor);
            return (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`card p-3 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md ${
                  !notif.is_read ? 'border-king-300 bg-king-50/50 dark:bg-surface-dark-card' : ''
                }`}
              >
                <div className="relative">
                  <Avatar user={notif.actor} size="md" showVerified showAdmin />
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-surface-dark-card rounded-full p-0.5">
                    {getIcon(notif.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {notif.content ? (
                      <span className="whitespace-pre-wrap">{notif.content}</span>
                    ) : (
                      <>
                        <span className="font-medium" style={nameColor ? { color: nameColor } : undefined}>
                          {getDisplayName(notif.actor)}
                        </span>{' '}
                        {getNotificationText(notif.type)}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatTime(notif.created_at)}</p>
                </div>
                {!notif.is_read && <div className="w-2 h-2 bg-king-500 rounded-full flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
