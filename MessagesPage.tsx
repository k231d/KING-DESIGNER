import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Paperclip, Mic, X, Edit2, Trash2, Check, Play, Pause, Search, MessageSquare, Reply, ChevronLeft, CheckCheck, Eye, AlertCircle } from 'lucide-react';
import { supabase, STORAGE_BUCKETS } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import { Avatar } from '@/components/Avatar';
import { MediaPreview } from '@/components/MediaPreview';
import { getDisplayName, getNameColor, getNameStyle, shouldUseAnimatedName, formatTime, formatLastSeen, getFileType } from '@/lib/helpers';
import type { Conversation, Message, MessageRequest, Profile, MediaItem } from '@/types';

interface MessagesPageProps {
  targetUserId?: string;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

export function MessagesPage({ targetUserId, onNavigate }: MessagesPageProps) {
  const { profile } = useAuth();
  const { t, lang } = useLang();
  const [conversations, setConversations] = useState<(Conversation & { other_user: Profile; last_message?: Message })[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageRequests, setMessageRequests] = useState<MessageRequest[]>([]);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<Profile | null>(null);
  const [isMessageRequest, setIsMessageRequest] = useState(false);
  const [messageTab, setMessageTab] = useState<'all' | 'unread' | 'requests'>('all');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [requestConversationIds, setRequestConversationIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!audioBlob) {
      setAudioPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  const fetchConversations = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('conversations')
      .select('*, user1:profiles!conversations_user1_id_fkey(*), user2:profiles!conversations_user2_id_fkey(*)')
      .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
      .order('updated_at', { ascending: false });

    if (data) {
      const convos = data.map((c) => {
        const otherUser = c.user1_id === profile.id ? c.user2 : c.user1;
        return { ...c, other_user: otherUser };
      }) as (Conversation & { other_user: Profile })[];
      convos.sort((a, b) => {
        if (!profile.is_admin && a.other_user?.is_admin !== b.other_user?.is_admin) {
          return a.other_user?.is_admin ? -1 : 1;
        }
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      setConversations(convos);
      const counts = await Promise.all(convos.map(async (conversation) => {
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', conversation.id).neq('sender_id', profile.id).neq('status', 'seen');
        return [conversation.id, count || 0] as const;
      }));
      setUnreadCounts(Object.fromEntries(counts));
      const { data: pendingRequests } = await supabase.from('message_requests').select('conversation_id').eq('status', 'pending');
      setRequestConversationIds(new Set((pendingRequests || []).map((request) => request.conversation_id)));
    }
  }, [profile]);

  const fetchMessages = useCallback(async () => {
    if (!activeConversation) return;

    let messagesResult = await supabase
      .from('messages')
      .select('*, reply_to:messages!messages_reply_to_id_fkey(*)')
      .eq('conversation_id', activeConversation.id)
      .order('created_at', { ascending: true });

    if (messagesResult.error) {
      messagesResult = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeConversation.id)
        .order('created_at', { ascending: true });
    }

    if (messagesResult.error) {
      setMessageError('تعذر تحميل الرسائل حالياً. حاول مرة أخرى.');
      return;
    }

    const requestsResult = await supabase
      .from('message_requests')
      .select('*')
      .eq('conversation_id', activeConversation.id)
      .order('created_at', { ascending: true });

    setMessageError(null);
    const loadedMessages = (messagesResult.data || []) as Message[];
    setMessages(loadedMessages);
    setMessageRequests(requestsResult.error ? [] : (requestsResult.data || []) as MessageRequest[]);

    if (profile) {
      const unseen = loadedMessages.filter((m) => m.sender_id !== profile.id && m.status !== 'seen');
      if (unseen.length > 0) {
        await supabase.rpc('mark_messages_seen', { p_message_ids: unseen.map((m) => m.id) });
      }
    }
  }, [activeConversation, profile]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel(`messages-live-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { fetchConversations(); fetchMessages(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_requests' }, () => { fetchConversations(); fetchMessages(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, fetchConversations, fetchMessages]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (targetUserId && profile) {
      startConversationWith(targetUserId);
    }
  }, [targetUserId, profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateMessageRequestStatus = async (userId: string) => {
    if (!profile) return;
    const [{ data: friendship }, { data: target }] = await Promise.all([
      supabase
        .from('friendships')
        .select('id')
        .or(`and(requester_id.eq.${profile.id},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${profile.id})`)
        .eq('status', 'accepted')
        .maybeSingle(),
      supabase.from('profiles').select('is_admin').eq('id', userId).maybeSingle(),
    ]);
    setIsMessageRequest(!friendship && !target?.is_admin);
  };

  const startConversationWith = async (userId: string) => {
    if (!profile) return;
    const { data: friendship } = await supabase.from('friendships').select('id').or(`and(requester_id.eq.${profile.id},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${profile.id})`).eq('status', 'accepted').maybeSingle();
    if (!friendship) {
      setMessageError('لا يمكن بدء المحادثة إلا بعد قبول طلب الصداقة.');
      return;
    }
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(user1_id.eq.${profile.id},user2_id.eq.${userId}),and(user2_id.eq.${profile.id},user1_id.eq.${userId})`)
      .maybeSingle();

    await updateMessageRequestStatus(userId);

    if (existing) {
      setActiveConversation(existing as Conversation);
      setActiveUserId(userId);
    } else {
      const user1Id = profile.id < userId ? profile.id : userId;
      const user2Id = profile.id < userId ? userId : profile.id;
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ user1_id: user1Id, user2_id: user2Id })
        .select('*')
        .maybeSingle();
      if (newConv) {
        setActiveConversation(newConv as Conversation);
        setActiveUserId(userId);
        fetchConversations();
      }
    }
  };

  const handleSearchUser = async () => {
    if (!searchId.trim()) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('king_id', parseInt(searchId))
      .maybeSingle();
    setSearchResult(data as Profile | null);
  };

  const handleSendMessage = async () => {
    if (!profile || !activeConversation) return;
    if (isMessageRequest) {
      setMessageError('لا يمكن إرسال الرسائل قبل قبول طلب الصداقة.');
      return;
    }
    if (!newMessage.trim() && mediaItems.length === 0 && !audioBlob) return;

    setMessageError(null);
    let voiceUrl: string | null = null;
    if (audioBlob) {
      const path = `${profile.id}/voice-${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKETS.MESSAGES).upload(path, audioBlob);
      if (uploadError) {
        setMessageError('تعذر رفع الرسالة الصوتية. حاول مرة أخرى.');
        return;
      }
      const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKETS.MESSAGES).getPublicUrl(path);
      voiceUrl = publicUrlData.publicUrl;
    }

    const result = isMessageRequest
      ? await supabase.from('message_requests').insert({
          conversation_id: activeConversation.id,
          sender_id: profile.id,
          content: newMessage.trim(),
          media: mediaItems,
          voice_url: voiceUrl,
        })
      : await supabase.from('messages').insert({
          conversation_id: activeConversation.id,
          sender_id: profile.id,
          content: newMessage.trim(),
          media: mediaItems,
          voice_url: voiceUrl,
          status: 'sent',
          reply_to_id: replyToMessage?.id || null,
        });

    if (result.error) {
      setMessageError('تعذر إرسال الرسالة. حاول مرة أخرى.');
      return;
    }

    const { error: conversationError } = await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', activeConversation.id);
    if (conversationError) {
      setMessageError('تم إرسال الرسالة، لكن تعذر تحديث المحادثة.');
    }

    // Do NOT send notifications while in the chat page - only send from other pages

    setNewMessage('');
    setMediaItems([]);
    setAudioBlob(null);
    setReplyToMessage(null);
    fetchMessages();
    fetchConversations();
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !profile) return;
    setUploading(true);
    const items: MediaItem[] = [];
    for (const file of Array.from(files)) {
      const path = `${profile.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.MESSAGES).upload(path, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKETS.MESSAGES).getPublicUrl(path);
        items.push({ type: getFileType(file.name), url: publicUrl, name: file.name, size: file.size });
      }
    }
    setMediaItems([...mediaItems, ...items]);
    setUploading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      // mic permission denied
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setAudioBlob(null);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) return;
    await supabase.from('messages').update({ content: editContent, is_edited: true }).eq('id', messageId);
    setEditingMessageId(null);
    setEditContent('');
    fetchMessages();
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase.from('messages').update({ is_deleted: true, content: '' }).eq('id', messageId);
    if (error) {
      setMessageError('تعذر حذف الرسالة. حاول مرة أخرى.');
      return;
    }
    fetchMessages();
  };

  const handleMessageRequest = async (request: MessageRequest, status: 'accepted' | 'rejected') => {
    const { error } = await supabase
      .from('message_requests')
      .update({ status })
      .eq('id', request.id);
    if (error) {
      setMessageError('تعذر تحديث طلب الرسالة. حاول مرة أخرى.');
      return;
    }
    fetchMessages();
  };

  const canEditOrDelete = (msg: Message) => {
    if (!profile) return false;
    if (msg.sender_id !== profile.id) return false;
    const ageMs = Date.now() - new Date(msg.created_at).getTime();
    return ageMs < 60000;
  };

  const visibleConversations = conversations.filter((conversation) => {
    if (messageTab === 'unread') return (unreadCounts[conversation.id] || 0) > 0;
    if (messageTab === 'requests') return requestConversationIds.has(conversation.id);
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-3rem)] -m-4 md:-m-6">
      {/* Conversation List */}
      <div className={`w-full md:w-80 border-r border-king-100 dark:border-surface-dark-border flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-king-100 dark:border-surface-dark-border">
          <h2 className="font-display font-bold text-lg text-gray-900 dark:text-king-50 mb-3">{t('messages')}</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
              placeholder={t('searchById')}
              className="input-field text-sm"
            />
            <button onClick={handleSearchUser} className="btn-secondary px-3">
              <Search className="w-4 h-4" />
            </button>
          </div>
          {searchResult && (
            <div className="mt-2 p-2 bg-king-50 dark:bg-surface-dark-alt rounded-xl flex items-center gap-2">
              <Avatar user={searchResult} size="sm" showRing showVerified showAdmin showBadges />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${shouldUseAnimatedName(searchResult) ? 'animated-name' : ''}`} style={getNameStyle(searchResult)}>{getDisplayName(searchResult)}</p>
                <p className="text-xs text-gray-500">{t('id')}: {searchResult.king_id}</p>
              </div>
              <button onClick={() => startConversationWith(searchResult.id)} className="btn-primary text-xs px-2 py-1">{t('chat')}</button>
            </div>
          )}
          <div className="flex gap-1 mt-3 bg-king-50 dark:bg-surface-dark-alt rounded-xl p-1">
            {([['all', 'الكل'], ['unread', 'غير مقروءة'], ['requests', 'الطلبات']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setMessageTab(id)} className={`flex-1 text-xs rounded-lg px-2 py-2 transition-colors ${messageTab === id ? 'bg-white dark:bg-surface-dark-card text-king-600 shadow-sm' : 'text-gray-500'}`}>
                {label}{id === 'unread' && Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) > 0 ? ` (${Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)})` : ''}{id === 'requests' && requestConversationIds.size > 0 ? ` (${requestConversationIds.size})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {visibleConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('noConversations')}</p>
              <p className="text-xs mt-1">{t('searchById')}</p>
            </div>
          ) : (
            visibleConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  setActiveConversation(conv);
                  setActiveUserId(conv.other_user?.id || '');
                  if (conv.other_user?.id) updateMessageRequestStatus(conv.other_user.id);
                }}
                className={`flex items-center gap-3 p-3 cursor-pointer border-b border-king-50 dark:border-surface-dark-border hover:bg-king-50 dark:hover:bg-surface-dark-alt transition-colors ${
                  activeConversation?.id === conv.id ? 'bg-king-50 dark:bg-surface-dark-alt' : ''
                }`}
              >
                <Avatar user={conv.other_user} size="md" showRing showVerified showAdmin showBadges />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium truncate ${shouldUseAnimatedName(conv.other_user) ? 'animated-name' : ''}`} style={getNameStyle(conv.other_user)}>
                      {getDisplayName(conv.other_user)}
                    </span>
                    {conv.other_user?.last_seen && new Date().getTime() - new Date(conv.other_user.last_seen).getTime() < 60000 && (
                      <span className="w-2 h-2 rounded-full bg-success-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {conv.other_user?.is_admin ? t('supportChat') : formatLastSeen(conv.other_user?.last_seen || null, lang)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${activeConversation ? 'flex' : 'hidden md:flex'}`}>
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-20" />
              <p>{t('selectConversation')}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 p-3 border-b border-king-100 dark:border-surface-dark-border">
              <button onClick={() => setActiveConversation(null)} className="md:hidden btn-ghost p-2">
                <X className="w-5 h-5" />
              </button>
              <Avatar user={conversations.find((c) => c.id === activeConversation.id)?.other_user} size="sm" showRing showVerified showAdmin showBadges />
              <div>
                <p className={`text-sm font-medium ${shouldUseAnimatedName(conversations.find((c) => c.id === activeConversation.id)?.other_user) ? 'animated-name' : ''}`} style={getNameStyle(conversations.find((c) => c.id === activeConversation.id)?.other_user)}>
                  {getDisplayName(conversations.find((c) => c.id === activeConversation.id)?.other_user)}
                </p>
                <p className="text-xs text-gray-500">{formatLastSeen(conversations.find((c) => c.id === activeConversation.id)?.other_user?.last_seen || null, lang)}</p>
              </div>
              {isMessageRequest && (
                <span className="ml-auto text-xs bg-warning-100 text-warning-700 dark:bg-warning-700/30 dark:text-warning-400 px-2 py-1 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {t('messageRequest')}
                </span>
              )}
            </div>

            {messageError && (
              <div className="px-4 py-2 bg-error-50 dark:bg-error-700/20 border-b border-error-100 dark:border-error-700/30 text-xs text-error-600 dark:text-error-300">
                {messageError}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto chat-scroll p-4 space-y-2 bg-king-50/30 dark:bg-surface-dark/50">
              {messages.map((msg) => {
                const isOwn = msg.sender_id === profile?.id;
                const canEdit = canEditOrDelete(msg);

                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <button type="button" className={`flex-shrink-0 ${isOwn ? 'order-2' : 'order-1'}`} onClick={() => onNavigate?.('profile', { userId: msg.sender_id })} title="زيارة الملف">
                      <Avatar user={isOwn ? profile : conversations.find((conversation) => conversation.id === activeConversation.id)?.other_user} size="xs" showVerified showAdmin />
                    </button>
                    <div className={`group max-w-[75%] ${isOwn ? 'items-end order-1' : 'items-start order-2'} flex flex-col`}>
                      {editingMessageId === msg.id ? (
                        <div className="flex gap-1">
                          <input
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleEditMessage(msg.id)}
                            className="input-field text-sm py-1.5"
                            autoFocus
                          />
                          <button onClick={() => handleEditMessage(msg.id)} className="btn-primary p-1.5">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingMessageId(null)} className="btn-ghost p-1.5">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`rounded-2xl px-3.5 py-2 ${isOwn ? 'bg-king-500 text-white' : 'bg-white dark:bg-surface-dark-card text-gray-900 dark:text-king-50 border border-king-100 dark:border-surface-dark-border'}`}
                          onClick={() => { if (!isOwn) { /* double-click to reply */ } }}
                          onDoubleClick={() => setReplyToMessage(msg)}
                        >
                          {msg.is_deleted ? (
                            <p className="text-sm italic opacity-60">{t('messageDeleted')}</p>
                          ) : (
                            <>
                              {msg.reply_to && (
                                <div className={`mb-1.5 px-2 py-1 rounded-lg text-xs ${isOwn ? 'bg-white/15' : 'bg-king-50 dark:bg-surface-dark-alt'}`}>
                                  <p className={`font-medium ${isOwn ? 'text-white/80' : 'text-king-600 dark:text-king-400'}`}>{t('replyToMessage')}</p>
                                  <p className={`truncate ${isOwn ? 'text-white/60' : 'text-gray-500'}`}>{msg.reply_to.content || (msg.reply_to.voice_url ? '🎤 ' + t('voiceMessageReady') : '📎')}</p>
                                </div>
                              )}
                              {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                              {msg.media && msg.media.length > 0 && (
                                <div className="mt-1 max-w-[200px]">
                                  <MediaPreview media={msg.media} />
                                </div>
                              )}
                              {msg.voice_url && <VoicePlayer url={msg.voice_url} isOwn={isOwn} messageId={msg.id} senderId={msg.sender_id} heard={msg.voice_heard} />}
                              <div className="flex items-center gap-1 mt-0.5">
                                {msg.is_edited && <span className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>{t('edited')}</span>}
                                {isOwn && (
                                  <span className="text-[10px] flex items-center gap-0.5 ml-auto">
                                    {msg.status === 'seen' ? <><Eye className="w-3 h-3" /> {t('messageSeen')}</> : msg.status === 'delivered' ? <><CheckCheck className="w-3 h-3" /> {t('messageDelivered')}</> : <><Check className="w-3 h-3" /> {t('messageSent')}</>}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {!msg.is_deleted && editingMessageId !== msg.id && (
                        <div className="hidden group-hover:flex gap-1 mt-0.5 items-center">
                          <button onClick={() => setReplyToMessage(msg)} className="p-1 text-gray-400 hover:text-king-500" title={t('replyToMessage')}>
                            <Reply className="w-3 h-3" />
                          </button>
                          {canEdit && (
                            <>
                              <button onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content); }} className="p-1 text-gray-400 hover:text-king-500">
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 text-gray-400 hover:text-error-500">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          <span className="text-[10px] text-gray-400 px-1">{formatTime(msg.created_at, lang)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {messageRequests.map((request) => {
                const isOwnRequest = request.sender_id === profile?.id;
                return (
                  <div key={request.id} className={`flex ${isOwnRequest ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 border ${isOwnRequest ? 'bg-king-100 dark:bg-king-900/30 border-king-200 dark:border-king-700' : 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-700'}`}>
                      <div className="flex items-center gap-1 text-[10px] text-warning-700 dark:text-warning-300 mb-1">
                        <AlertCircle className="w-3 h-3" /> {t('messageRequest')}
                      </div>
                      {request.content && <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">{request.content}</p>}
                      {request.media.length > 0 && <MediaPreview media={request.media} />}
                      {request.voice_url && <VoicePlayer url={request.voice_url} isOwn={isOwnRequest} messageId={request.id} senderId={request.sender_id} heard={false} />}
                      {request.status === 'pending' && !isOwnRequest ? (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleMessageRequest(request, 'accepted')} className="btn-primary text-xs px-2 py-1">{t('acceptMessage')}</button>
                          <button onClick={() => handleMessageRequest(request, 'rejected')} className="btn-secondary text-xs px-2 py-1">{t('rejectMessage')}</button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                          {request.status === 'accepted' ? t('messageRequestAccepted') : request.status === 'rejected' ? t('messageRequestRejected') : t('messageRequestPending')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Preview */}
            {replyToMessage && (
              <div className="px-4 py-2 bg-king-50 dark:bg-surface-dark-alt flex items-center gap-2">
                <Reply className="w-4 h-4 text-king-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-king-600 dark:text-king-400 font-medium">{t('replyToMessage')}</p>
                  <p className="text-xs text-gray-500 truncate">{replyToMessage.content || (replyToMessage.voice_url ? '🎤' : '📎')}</p>
                </div>
                <button onClick={() => setReplyToMessage(null)} className="text-gray-400 hover:text-error-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Recording Preview */}
            {audioBlob && (
              <div className="px-4 py-2 bg-king-50 dark:bg-surface-dark-alt flex items-center gap-2">
                <div className="flex items-center gap-1 text-king-600 dark:text-king-400 text-sm">
                  <Mic className="w-4 h-4" />
                  {t('voiceMessageReady')} ({recordingTime}s)
                </div>
                {audioPreviewUrl && <audio controls src={audioPreviewUrl} className="h-8 max-w-[190px]" aria-label="معاينة التسجيل الصوتي" />}
                <button onClick={() => { setAudioBlob(null); setRecordingTime(0); }} className="text-error-500 text-xs ml-auto">{t('cancel')}</button>
              </div>
            )}

            {/* Media Preview */}
            {mediaItems.length > 0 && (
              <div className="px-4 py-2 bg-king-50 dark:bg-surface-dark-alt">
                <div className="max-w-[200px]">
                  <MediaPreview media={mediaItems} />
                </div>
                <button onClick={() => setMediaItems([])} className="text-xs text-error-500 mt-1">Remove all</button>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 border-t border-king-100 dark:border-surface-dark-border flex items-center gap-2">
              <label className="cursor-pointer text-gray-400 hover:text-king-500">
                <Paperclip className="w-5 h-5" />
                <input type="file" multiple accept="image/*,video/*,audio/*,.pdf,.gif,.svga" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
              </label>

              {isRecording ? (
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-error-500 text-sm flex items-center gap-1">
                    <span className="w-2 h-2 bg-error-500 rounded-full animate-pulse" />
                    {t('recording')} {recordingTime}s
                  </span>
                  <button onClick={cancelRecording} className="text-error-500 text-sm ml-auto">{t('cancel')}</button>
                  <button onClick={stopRecording} className="btn-primary text-sm">{t('stop')}</button>
                </div>
              ) : newMessage.trim() || mediaItems.length > 0 || audioBlob ? (
                <>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={t('typeMessage')}
                    className="input-field flex-1"
                  />
                  <button onClick={handleSendMessage} disabled={uploading} className="btn-primary p-2.5">
                    {uploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={t('typeMessage')}
                    className="input-field flex-1"
                  />
                  <button onClick={startRecording} className="btn-ghost p-2.5">
                    <Mic className="w-5 h-5 text-king-500" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function VoicePlayer({ url, isOwn, messageId, senderId, heard }: { url: string; isOwn: boolean; messageId: string; senderId: string; heard: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
      if (senderId && !heard && !isOwn) {
        supabase.rpc('mark_message_voice_heard', { p_message_id: messageId });
      }
    }
  };

  return (
    <div className="flex items-center gap-2 py-1">
      <button onClick={toggle} className={`p-1 rounded-full ${isOwn ? 'bg-white/20' : 'bg-king-100 dark:bg-surface-dark-alt'}`}>
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
      <div className="flex items-center gap-0.5">
        {[3, 6, 9, 6, 3, 6, 9, 6, 3].map((h, i) => (
          <div key={i} className={`w-0.5 rounded-full ${isOwn ? 'bg-white/60' : 'bg-king-400'}`} style={{ height: `${h}px` }} />
        ))}
      </div>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
    </div>
  );
}
