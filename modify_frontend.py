from pathlib import Path

ROOT = Path('/home/ubuntu/king-design-published/client/src')


def replace(path: Path, old: str, new: str):
    text = path.read_text()
    if old not in text:
        raise RuntimeError(f'Expected text not found in {path}: {old[:120]!r}')
    path.write_text(text.replace(old, new, 1))


# Shared asset URL metadata helpers. The expiry is stored in the existing URL fragment,
# so Supabase storage URLs remain valid and no schema/database change is needed.
helpers = ROOT / 'lib/helpers.ts'
replace(
    helpers,
    "export function getFileType(filename: string): 'image' | 'video' | 'audio' | 'pdf' | 'gif' | 'file' {",
    """export type AssetDurationChoice = 'permanent' | '1h' | '1d' | '7d' | '30d' | '90d' | 'existing';

const ASSET_EXPIRY_MARKER = '#king-asset-expires=';
const ASSET_DURATION_HOURS: Record<Exclude<AssetDurationChoice, 'permanent' | 'existing'>, number> = {
  '1h': 1,
  '1d': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  '90d': 24 * 90,
};

export function getAssetSource(value: string | null | undefined): string | null {
  if (!value) return null;
  const markerIndex = value.indexOf(ASSET_EXPIRY_MARKER);
  const source = markerIndex >= 0 ? value.slice(0, markerIndex) : value;
  return source.trim() || null;
}

export function getAssetExpiry(value: string | null | undefined): number | null {
  if (!value) return null;
  const markerIndex = value.indexOf(ASSET_EXPIRY_MARKER);
  if (markerIndex < 0) return null;
  const raw = value.slice(markerIndex + ASSET_EXPIRY_MARKER.length).split('#')[0];
  const expiry = Number(raw);
  return Number.isFinite(expiry) ? expiry : null;
}

export function isAssetActive(value: string | null | undefined, now = Date.now()): boolean {
  const source = getAssetSource(value);
  if (!source) return false;
  const expiry = getAssetExpiry(value);
  return expiry === null || expiry > now;
}

export function getActiveAssetUrl(value: string | null | undefined): string | null {
  return isAssetActive(value) ? getAssetSource(value) : null;
}

export function getAssetDurationChoice(value: string | null | undefined, now = Date.now()): AssetDurationChoice {
  const expiry = getAssetExpiry(value);
  if (expiry === null) return 'permanent';
  const remainingHours = (expiry - now) / (60 * 60 * 1000);
  const choices = Object.entries(ASSET_DURATION_HOURS) as [Exclude<AssetDurationChoice, 'permanent' | 'existing'>, number][];
  const closest = choices.reduce((best, current) => {
    return Math.abs(current[1] - remainingHours) < Math.abs(best[1] - remainingHours) ? current : best;
  });
  return Math.abs(closest[1] - remainingHours) <= Math.max(1, closest[1] * 0.03) ? closest[0] : 'existing';
}

export function withAssetDuration(
  value: string | null | undefined,
  duration: AssetDurationChoice,
  now = Date.now(),
): string | null {
  const source = getAssetSource(value);
  if (!source) return null;
  if (duration === 'existing') return value?.trim() || source;
  if (duration === 'permanent') return source;
  const expiry = now + ASSET_DURATION_HOURS[duration] * 60 * 60 * 1000;
  return `${source}${ASSET_EXPIRY_MARKER}${expiry}`;
}

export function getFileType(filename: string): 'image' | 'video' | 'audio' | 'pdf' | 'gif' | 'file' {""",
)

# Profile asset type includes the actual splash duration column used by Supabase.
types = ROOT / 'types.ts'
replace(types, "export interface SplashScreen { id: string; image_url: string; title?: string; subtitle?: string; enabled?: boolean; duration?: number; [key: string]: any; }", "export interface SplashScreen { id: string; image_url: string; title?: string; subtitle?: string; enabled?: boolean; duration?: number; duration_seconds?: number; [key: string]: any; }")

# Avatar should never render an expired frame.
avatar = ROOT / 'components/Avatar.tsx'
replace(avatar, "import { getInitials, getAvatarUrl, getNameColor, getDisplayName } from '@/lib/helpers';", "import { getInitials, getAvatarUrl, getNameColor, getDisplayName, getActiveAssetUrl } from '@/lib/helpers';")
replace(avatar, "      {user?.avatar_frame_url && (\n        <img\n          src={user.avatar_frame_url}", "      {getActiveAssetUrl(user?.avatar_frame_url) && (\n        <img\n          src={getActiveAssetUrl(user?.avatar_frame_url) || undefined}")

# Fix random splash duration: use the selected splash, not the first row.
app = ROOT / 'App.tsx'
replace(
    app,
    """      if (screens.length > 0) {
        setSplash(screens[Math.floor(Math.random() * screens.length)]);
        setSplashSeconds(screens[0].duration_seconds || 5);
      }""",
    """      if (screens.length > 0) {
        const selectedScreen = screens[Math.floor(Math.random() * screens.length)];
        setSplash(selectedScreen);
        setSplashSeconds(selectedScreen.duration_seconds || selectedScreen.duration || 5);
      }""",
)

# Profile page: show intro video for up to ten seconds with an explicit skip action.
profile = ROOT / 'pages/ProfilePage.tsx'
replace(profile, "import { useState, useEffect, useCallback } from 'react';", "import { useState, useEffect, useCallback, useRef } from 'react';")
replace(profile, "import { getDisplayName, getNameColor, getNameStyle, shouldUseAnimatedName, getRankName, formatTime, formatLastSeen, copyToClipboard, getFileType } from '@/lib/helpers';", "import { getDisplayName, getNameColor, getNameStyle, shouldUseAnimatedName, getRankName, formatTime, formatLastSeen, copyToClipboard, getFileType, getActiveAssetUrl } from '@/lib/helpers';")
replace(profile, "  const [reviewIndex, setReviewIndex] = useState(0);", """  const [reviewIndex, setReviewIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(false);
  const [introSeconds, setIntroSeconds] = useState(10);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);""")
replace(
    profile,
    """  useEffect(() => {
    if (ratings.length < 2) return;
    const timer = window.setInterval(() => setReviewIndex((index) => (index + 1) % ratings.length), 3500);
    return () => window.clearInterval(timer);
  }, [ratings.length]);""",
    """  useEffect(() => {
    const introUrl = user?.intro_video_url?.trim();
    if (!introUrl) {
      setShowIntro(false);
      return;
    }
    setIntroSeconds(10);
    setShowIntro(true);
  }, [user?.id, user?.intro_video_url]);

  useEffect(() => {
    if (!showIntro || !user?.intro_video_url) return;
    const timer = window.setInterval(() => {
      setIntroSeconds((seconds) => {
        if (seconds <= 1) {
          setShowIntro(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    introVideoRef.current?.play().catch(() => undefined);
    return () => window.clearInterval(timer);
  }, [showIntro, user?.id, user?.intro_video_url]);

  useEffect(() => {
    if (ratings.length < 2) return;
    const timer = window.setInterval(() => setReviewIndex((index) => (index + 1) % ratings.length), 3500);
    return () => window.clearInterval(timer);
  }, [ratings.length]);""",
)
replace(profile, "  const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length : 0;", """  const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length : 0;
  const activeProfileCardUrl = getActiveAssetUrl(user.profile_card_url);""")
replace(profile, """  return (
    <div className=\"space-y-4\">""", """  return (
    <>
      {showIntro && user.intro_video_url && (
        <div className=\"fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in\" role=\"dialog\" aria-modal=\"true\" aria-label={lang === 'ar' ? 'فيديو الدخول' : 'Profile intro video'}>
          <div className=\"relative w-full max-w-2xl rounded-3xl overflow-hidden border border-white/15 bg-black shadow-2xl\">
            <video
              ref={introVideoRef}
              src={user.intro_video_url}
              autoPlay
              muted
              playsInline
              controls
              onEnded={() => setShowIntro(false)}
              onError={() => setShowIntro(false)}
              className=\"w-full max-h-[75vh] object-contain bg-black\"
            />
            <div className=\"absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-none\">
              <div className=\"flex items-center justify-between gap-3\">
                <span className=\"text-white text-sm font-medium\">{lang === 'ar' ? 'فيديو الدخول' : 'Profile intro'}</span>
                <span className=\"text-white/80 text-xs\">{introSeconds} {t('secondsRemaining')}</span>
              </div>
            </div>
            <div className=\"absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/75 to-transparent flex justify-center\">
              <button type=\"button\" onClick={() => setShowIntro(false)} className=\"btn-secondary !bg-white/15 !text-white hover:!bg-white/25 border border-white/20\">
                <X className=\"w-4 h-4\" /> {t('skip')}
              </button>
            </div>
            <div className=\"absolute bottom-0 left-0 h-1 bg-king-400 transition-all duration-1000\" style={{ width: `${((10 - introSeconds) / 10) * 100}%` }} />
          </div>
        </div>
      )}
      <div className=\"space-y-4\">""")
replace(profile, """    </div>
  );
}

function ProfileEditModal""", """      </div>
    </>
  );
}

function ProfileEditModal""")
replace(profile, "button onClick={handleCopyId} style={user.profile_card_url ? { backgroundImage: `url(${user.profile_card_url})`, backgroundSize: 'cover' } : undefined}", "button onClick={handleCopyId} style={activeProfileCardUrl ? { backgroundImage: `url(${activeProfileCardUrl})`, backgroundSize: 'cover' } : undefined}")

# Admin page: make asset management durable and surface write/upload errors.
admin = ROOT / 'pages/AdminPage.tsx'
replace(admin, "import { getDisplayName, getNameColor, getRankName, formatTime } from '@/lib/helpers';", "import { getDisplayName, getNameColor, getRankName, formatTime, getAssetSource, getAssetDurationChoice, withAssetDuration, type AssetDurationChoice } from '@/lib/helpers';")
replace(admin, "  if (!profile?.is_admin) {\n    return <div className=\"card p-8 text-center text-gray-500\">{t('loading')}</div>;\n  }", "  if (!profile?.is_admin) {\n    return <div className=\"card p-8 text-center text-gray-500\">{t('noPermission')}</div>;\n  }")
replace(admin, """  const [avatarFrameUrl, setAvatarFrameUrl] = useState(user.avatar_frame_url || '');
  const [profileCardUrl, setProfileCardUrl] = useState(user.profile_card_url || '');
  const [introVideoUrl, setIntroVideoUrl] = useState(user.intro_video_url || '');""", """  const [avatarFrameUrl, setAvatarFrameUrl] = useState(getAssetSource(user.avatar_frame_url) || '');
  const [profileCardUrl, setProfileCardUrl] = useState(getAssetSource(user.profile_card_url) || '');
  const [introVideoUrl, setIntroVideoUrl] = useState(user.intro_video_url || '');
  const [frameDuration, setFrameDuration] = useState<AssetDurationChoice>(getAssetDurationChoice(user.avatar_frame_url));
  const [profileCardDuration, setProfileCardDuration] = useState<AssetDurationChoice>(getAssetDurationChoice(user.profile_card_url));""")
replace(
    admin,
    """  const handleAssetUpload = async (file: File, kind: 'frame' | 'card' | 'intro') => {
    const allowed = kind === 'frame' ? ['image/webp'] : kind === 'card' ? ['image/gif'] : ['video/mp4'];
    if (!allowed.includes(file.type)) { window.alert(kind === 'frame' ? 'يرجى اختيار WebP' : kind === 'card' ? 'يرجى اختيار GIF' : 'يرجى اختيار MP4'); return; }
    setAssetUploading(true);
    const ext = kind === 'frame' ? 'webp' : kind === 'card' ? 'gif' : 'mp4';""",
    """  const handleAssetUpload = async (file: File, kind: 'frame' | 'card' | 'intro') => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const allowed = kind === 'frame' ? ['webp'] : kind === 'card' ? ['gif'] : ['mp4'];
    if (!allowed.includes(extension)) { window.alert(kind === 'frame' ? 'يرجى اختيار ملف WebP' : kind === 'card' ? 'يرجى اختيار ملف GIF' : 'يرجى اختيار فيديو MP4'); return; }
    setAssetUploading(true);
    const ext = allowed[0];""",
)
replace(
    admin,
    """  const handleSave = async () => {
    setSaving(true);""",
    """  const handleSave = async () => {
    setSaving(true);""",
)
replace(
    admin,
    """      avatar_frame_url: avatarFrameUrl.trim() || null,
      profile_card_url: profileCardUrl.trim() || null,
      intro_video_url: introVideoUrl.trim() || null,
      name_gradient: gradientColors.length > 0 ? JSON.stringify(gradientColors) : null,
    }).eq('id', user.id);

    if (banType && banType !== user.ban_type) {""",
    """      avatar_frame_url: withAssetDuration(avatarFrameUrl, frameDuration),
      profile_card_url: withAssetDuration(profileCardUrl, profileCardDuration),
      intro_video_url: introVideoUrl.trim() || null,
      name_gradient: gradientColors.length > 0 ? JSON.stringify(gradientColors) : null,
    }).eq('id', user.id);

    if (profileError) {
      window.alert(profileError.message);
      setSaving(false);
      return;
    }

    if (banType && banType !== user.ban_type) {""",
)
# The previous replacement adds profileError usage; change the destructuring explicitly.
replace(admin, "    await supabase.from('profiles').update({", "    const { error: profileError } = await supabase.from('profiles').update({",)
# Restore the unrelated update calls after the first occurrence by targeting the exact unban block.
replace(admin, "    const { error: profileError } = await supabase.from('profiles').update({\n      ban_type: null,", "    await supabase.from('profiles').update({\n      ban_type: null,")
# Add error handling to unban and verify without changing the database contract.
replace(admin, """  const handleUnban = async () => {
    setSaving(true);
    await supabase.from('profiles').update({
      ban_type: null,""", """  const handleUnban = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      ban_type: null,""")
replace(admin, """    }).eq('id', user.id);
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'unban',""", """    }).eq('id', user.id);
    if (error) {
      window.alert(error.message);
      setSaving(false);
      return;
    }
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'unban',""")
# Replace the old identity section with controls for removal, replacement, and expiry.
replace(
    admin,
    """          {/* Identity styling */}
          <div className=\"pt-3 border-t border-king-100 dark:border-surface-dark-border space-y-2\">
            <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300\">إطار الصورة وخلفية ID</label>
            <input value={avatarFrameUrl} onChange={(e) => setAvatarFrameUrl(e.target.value)} placeholder=\"رابط إطار الصورة\" className=\"input-field text-sm\" />
            <input value={profileCardUrl} onChange={(e) => setProfileCardUrl(e.target.value)} placeholder=\"رابط خلفية بطاقة ID\" className=\"input-field text-sm\" />
            <input value={introVideoUrl} onChange={(e) => setIntroVideoUrl(e.target.value)} placeholder=\"رابط فيديو الدخول MP4\" className=\"input-field text-sm\" />
            <div className=\"grid grid-cols-3 gap-2\">
              <label className=\"btn-secondary text-xs text-center cursor-pointer\">رفع إطار WebP<input type=\"file\" accept=\"image/webp,.webp\" className=\"hidden\" onChange={(e) => e.target.files?.[0] && handleAssetUpload(e.target.files[0], 'frame')} /></label>
              <label className=\"btn-secondary text-xs text-center cursor-pointer\">رفع بطاقة GIF<input type=\"file\" accept=\"image/gif,.gif\" className=\"hidden\" onChange={(e) => e.target.files?.[0] && handleAssetUpload(e.target.files[0], 'card')} /></label>
              <label className=\"btn-secondary text-xs text-center cursor-pointer\">رفع دخولية MP4<input type=\"file\" accept=\"video/mp4,.mp4\" className=\"hidden\" onChange={(e) => e.target.files?.[0] && handleAssetUpload(e.target.files[0], 'intro')} /></label>
            </div>
            {assetUploading && <p className=\"text-xs text-king-500\">جاري رفع الأصل...</p>}
          </div>""",
    """          {/* Identity styling */}
          <div className=\"pt-3 border-t border-king-100 dark:border-surface-dark-border space-y-3\">
            <div>
              <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1\">{t('identityAssets')}</label>
              <p className=\"text-xs text-gray-500\">{t('identityAssetsHint')}</p>
            </div>
            <div className=\"space-y-2\">
              <div className=\"flex gap-2\">
                <input value={avatarFrameUrl} onChange={(e) => setAvatarFrameUrl(e.target.value)} placeholder={t('frameUrl')} className=\"input-field text-sm\" />
                {avatarFrameUrl && <button type=\"button\" onClick={() => setAvatarFrameUrl('')} className=\"btn-ghost text-error-500 px-3\" title={t('removeAsset')}><Trash2 className=\"w-4 h-4\" /></button>}
              </div>
              <div className=\"flex gap-2 items-center\">
                <label className=\"btn-secondary text-xs text-center cursor-pointer whitespace-nowrap\">{t('replaceFrame')}<input type=\"file\" accept=\"image/webp,.webp\" className=\"hidden\" onChange={(e) => e.target.files?.[0] && handleAssetUpload(e.target.files[0], 'frame')} /></label>
                <select value={frameDuration} onChange={(e) => setFrameDuration(e.target.value as AssetDurationChoice)} className=\"input-field text-xs py-2\" aria-label={t('frameDuration')}>
                  <option value=\"permanent\">{t('permanentAsset')}</option>
                  <option value=\"1h\">{t('oneHour')}</option>
                  <option value=\"1d\">{t('oneDay')}</option>
                  <option value=\"7d\">{t('sevenDays')}</option>
                  <option value=\"30d\">{t('thirtyDays')}</option>
                  <option value=\"90d\">{t('ninetyDays')}</option>
                  <option value=\"existing\">{t('keepCurrentDuration')}</option>
                </select>
              </div>
            </div>
            <div className=\"space-y-2\">
              <div className=\"flex gap-2\">
                <input value={profileCardUrl} onChange={(e) => setProfileCardUrl(e.target.value)} placeholder={t('profileCardUrl')} className=\"input-field text-sm\" />
                {profileCardUrl && <button type=\"button\" onClick={() => setProfileCardUrl('')} className=\"btn-ghost text-error-500 px-3\" title={t('removeAsset')}><Trash2 className=\"w-4 h-4\" /></button>}
              </div>
              <div className=\"flex gap-2 items-center\">
                <label className=\"btn-secondary text-xs text-center cursor-pointer whitespace-nowrap\">{t('replaceCard')}<input type=\"file\" accept=\"image/gif,.gif\" className=\"hidden\" onChange={(e) => e.target.files?.[0] && handleAssetUpload(e.target.files[0], 'card')} /></label>
                <select value={profileCardDuration} onChange={(e) => setProfileCardDuration(e.target.value as AssetDurationChoice)} className=\"input-field text-xs py-2\" aria-label={t('cardDuration')}>
                  <option value=\"permanent\">{t('permanentAsset')}</option>
                  <option value=\"1h\">{t('oneHour')}</option>
                  <option value=\"1d\">{t('oneDay')}</option>
                  <option value=\"7d\">{t('sevenDays')}</option>
                  <option value=\"30d\">{t('thirtyDays')}</option>
                  <option value=\"90d\">{t('ninetyDays')}</option>
                  <option value=\"existing\">{t('keepCurrentDuration')}</option>
                </select>
              </div>
            </div>
            <div className=\"space-y-2\">
              <div className=\"flex gap-2\">
                <input value={introVideoUrl} onChange={(e) => setIntroVideoUrl(e.target.value)} placeholder={t('introVideoUrl')} className=\"input-field text-sm\" />
                {introVideoUrl && <button type=\"button\" onClick={() => setIntroVideoUrl('')} className=\"btn-ghost text-error-500 px-3\" title={t('removeAsset')}><Trash2 className=\"w-4 h-4\" /></button>}
              </div>
              <label className=\"btn-secondary text-xs text-center cursor-pointer block\">{t('replaceIntroVideo')}<input type=\"file\" accept=\"video/mp4,.mp4\" className=\"hidden\" onChange={(e) => e.target.files?.[0] && handleAssetUpload(e.target.files[0], 'intro')} /></label>
              <p className=\"text-xs text-gray-500\">{t('introVideoHint')}</p>
            </div>
            {assetUploading && <p className=\"text-xs text-king-500\">{t('uploadingAsset')}</p>}
          </div>""",
)
# Improve the global frame manager's silent upload failures.
replace(admin, """    if (ext !== 'gif' && ext !== 'webp') return;
    const path = `avatar-frames/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('media').upload(path, file);
    if (error) return;""", """    if (ext !== 'gif' && ext !== 'webp') { window.alert(t('frameFileTypeError')); return; }
    const path = `avatar-frames/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('media').upload(path, file);
    if (error) { window.alert(error.message); return; }""")
replace(admin, """    await supabase.from('avatar_frames').insert({ name: newName.trim(), frame_url: newUrl, is_active: true });
    setSaving(false);""", """    const { error } = await supabase.from('avatar_frames').insert({ name: newName.trim(), frame_url: newUrl, is_active: true });
    if (error) window.alert(error.message);
    setSaving(false);""")
replace(admin, """    await supabase.from('avatar_frames').delete().eq('id', frame.id);
    fetchFrames();""", """    const { error } = await supabase.from('avatar_frames').delete().eq('id', frame.id);
    if (error) window.alert(error.message);
    fetchFrames();""")

# Translation keys for the new admin controls and profile intro.
translations = ROOT / 'lib/translations.ts'
replace(translations, "    avatarFrames: 'إطارات الأفاتار',", """    avatarFrames: 'إطارات الأفاتار',
    noPermission: 'ليس لديك صلاحية للوصول إلى هذه الصفحة',
    identityAssets: 'أصول هوية البروفايل',
    identityAssetsHint: 'يمكن إزالة الأصول أو استبدالها، مع تحديد مدة الإطار والبطاقة أو جعلها دائمة.',
    frameUrl: 'رابط إطار الصورة',
    profileCardUrl: 'رابط بطاقة البروفايل',
    introVideoUrl: 'رابط فيديو الدخول MP4',
    frameDuration: 'مدة الإطار',
    cardDuration: 'مدة البطاقة',
    permanentAsset: 'دائم',
    oneHour: 'ساعة واحدة',
    oneDay: 'يوم واحد',
    sevenDays: '7 أيام',
    thirtyDays: '30 يوماً',
    ninetyDays: '90 يوماً',
    keepCurrentDuration: 'الإبقاء على المدة الحالية',
    removeAsset: 'إزالة الأصل',
    replaceCard: 'استبدال البطاقة',
    replaceIntroVideo: 'استبدال فيديو الدخول',
    introVideoHint: 'يظهر فيديو الدخول عند فتح البروفايل لمدة 10 ثوانٍ مع إمكانية التخطي.',
    uploadingAsset: 'جاري رفع الأصل...',
    frameFileTypeError: 'يرجى اختيار ملف GIF أو WebP صالح.',""")
replace(translations, "    avatarFrames: 'Avatar Frames',", """    avatarFrames: 'Avatar Frames',
    noPermission: 'You do not have permission to access this page',
    identityAssets: 'Profile identity assets',
    identityAssetsHint: 'Remove or replace assets, set a frame or card duration, or keep them permanent.',
    frameUrl: 'Avatar frame URL',
    profileCardUrl: 'Profile card URL',
    introVideoUrl: 'Intro video MP4 URL',
    frameDuration: 'Frame duration',
    cardDuration: 'Card duration',
    permanentAsset: 'Permanent',
    oneHour: '1 hour',
    oneDay: '1 day',
    sevenDays: '7 days',
    thirtyDays: '30 days',
    ninetyDays: '90 days',
    keepCurrentDuration: 'Keep current duration',
    removeAsset: 'Remove asset',
    replaceCard: 'Replace card',
    replaceIntroVideo: 'Replace intro video',
    introVideoHint: 'The intro video appears when opening a profile for 10 seconds with a skip option.',
    uploadingAsset: 'Uploading asset...',
    frameFileTypeError: 'Please choose a valid GIF or WebP file.',""")

print('Frontend changes applied.')
