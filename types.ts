export interface MediaItem {
  id?: string;
  url: string;
  type: string;
  name?: string;
  size?: number;
  edit?: any;
  [key: string]: any;
}

export interface Profile {
  id: string;
  king_id: number;
  email: string;
  account_type?: 'client' | 'designer' | string;
  display_name?: string;
  username?: string | null;
  avatar_frame_url?: string | null;
  avatar_frame_enabled?: boolean;
  avatar_frame_expires_at?: string | null;
  profile_card_url?: string | null;
  profile_card_enabled?: boolean;
  profile_card_expires_at?: string | null;
  intro_video_url?: string | null;
  intro_video_enabled?: boolean;
  intro_video_duration_seconds?: number;
  intro_video_expires_at?: string | null;
  bio?: string;
  country?: string | null;
  age?: number | null;
  is_admin?: boolean;
  is_verified?: boolean;
  vip_level?: number;
  is_pro?: boolean;
  pro_color?: string | null;
  vip_colors?: string[];
  designer_rank?: number;
  ban_type?: 'permanent' | 'temporary' | 'photo' | null;
  ban_until?: string | null;
  is_banned?: boolean;
  photo_banned?: boolean;
  cv_summary?: string;
  cv_experience?: string;
  cv_education?: string;
  cv_skills?: string;
  cv_phone?: string;
  cv_location?: string;
  whatsapp_number?: string | null;
  last_seen?: string | null;
  social_links?: Record<string, string> | null;
  avatar_gif_url?: string | null;
  name_gradient?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface Post { id: string; user_id: string; content?: string; media?: MediaItem[]; audience?: string; created_at: string; updated_at?: string; view_count?: number; user?: Profile | null; [key: string]: any; }
export interface Story { id: string; user_id: string; content?: string; media?: MediaItem[]; audience?: string; created_at: string; expires_at?: string; user?: Profile | null; [key: string]: any; }
export interface Comment { id: string; post_id?: string | null; story_id?: string | null; user_id: string; content: string; parent_id?: string | null; created_at: string; user?: Profile | null; replies?: Comment[]; [key: string]: any; }
export interface Like { id?: string; post_id?: string; story_id?: string; user_id: string; created_at?: string; [key: string]: any; }
export interface Friendship { id: string; requester_id: string; receiver_id: string; status: 'pending' | 'accepted' | 'rejected' | string; created_at?: string; requester?: Profile | null; receiver?: Profile | null; [key: string]: any; }
export interface StoryView { id?: string; story_id: string; user_id: string; reaction?: string | null; created_at?: string; user?: Profile | null; [key: string]: any; }
export interface Conversation { id: string; user1_id: string; user2_id: string; is_pinned?: boolean; created_at?: string; other_user?: Profile | null; [key: string]: any; }
export interface Message { id: string; conversation_id: string; sender_id: string; content?: string; media?: MediaItem[]; voice_url?: string | null; status?: string; voice_heard?: boolean; reply_to_id?: string | null; reply_to?: Message | null; created_at: string; sender?: Profile | null; [key: string]: any; }
export interface MessageRequest { id: string; conversation_id: string; sender_id: string; content?: string; media?: MediaItem[]; voice_url?: string | null; status?: string; created_at: string; sender?: Profile | null; [key: string]: any; }
export interface Notification { id: string; user_id: string; actor_id?: string | null; type: string; content?: string | null; is_read?: boolean; created_at: string; [key: string]: any; }
export interface Verification { id: string; user_id: string; document_url?: string; status: string; admin_note?: string | null; created_at?: string; updated_at?: string; [key: string]: any; }
export interface DesignerService { id: string; designer_id: string; title?: string; description?: string; price?: number; cover_url?: string | null; [key: string]: any; }
export interface PortfolioSection { id: string; designer_id: string; title?: string; description?: string; media?: MediaItem[]; [key: string]: any; }
export interface PortfolioFolder { id: string; designer_id: string; name?: string; description?: string; cover_url?: string | null; media?: MediaItem[]; [key: string]: any; }
export interface ServiceRequest { id: string; user_id: string; service_id?: string | null; designer_id?: string | null; status?: string; cover_url?: string | null; reject_reason?: string | null; accepted_at?: string | null; rejected_at?: string | null; created_at?: string; requester?: Profile | null; designer?: Profile | null; service?: DesignerService | null; [key: string]: any; }
export interface Rating { id: string; rater_id: string; rated_id: string; rating: number; comment?: string; created_at?: string; rater?: Profile | null; [key: string]: any; }
export interface AvatarFrame { id: string; name: string; frame_url: string; is_active: boolean; [key: string]: any; }
export interface SplashScreen { id: string; image_url: string; title?: string; subtitle?: string; enabled?: boolean; media_type?: 'image' | 'video'; duration_seconds?: number; duration?: number; [key: string]: any; }
export interface Report { id: string; reporter_id: string; reported_user_id?: string; video_url?: string | null; [key: string]: any; }
