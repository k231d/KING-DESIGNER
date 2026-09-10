# King Designer - Deployment Guide

## نشر على Vercel مع قاعدة بيانات Supabase

هذا الدليل يشرح كيفية نشر تطبيق King Designer على Vercel وربطه بقاعدة بيانات Supabase.

## المتطلبات الأساسية

- حساب GitHub
- حساب Vercel (متصل بـ GitHub)
- حساب Supabase
- Node.js 18+ و pnpm مثبتة محليًا

## الخطوة 1: إعداد Supabase Database

### 1.1 إنشاء مشروع Supabase

1. انتقل إلى [supabase.com](https://supabase.com)
2. سجل الدخول أو أنشئ حسابًا جديدًا
3. انقر على "New Project"
4. املأ البيانات:
   - **Project Name**: KING-DESIGNER
   - **Database Password**: احفظ كلمة المرور في مكان آمن
   - **Region**: اختر أقرب منطقة لك
5. انقر على "Create new project" والانتظار للمعالجة

### 1.2 الحصول على بيانات الاتصال

1. اذهب إلى **Settings** → **API**
2. انسخ البيانات التالية:
   - `VITE_SUPABASE_URL`: URL المشروع
   - `VITE_SUPABASE_ANON_KEY`: Anon public key

### 1.3 إنشاء جداول قاعدة البيانات

اذهب إلى **SQL Editor** وقم بتشغيل البرنامج النصي التالي:

```sql
-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  king_id INTEGER UNIQUE,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_type TEXT,
  intro_video_url TEXT,
  intro_video_enabled BOOLEAN DEFAULT TRUE,
  intro_video_duration_seconds INTEGER DEFAULT 5,
  intro_video_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  content TEXT NOT NULL,
  media_urls TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES profiles(user_id),
  receiver_id UUID NOT NULL REFERENCES profiles(user_id),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  type TEXT NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES profiles(user_id),
  receiver_id UUID NOT NULL REFERENCES profiles(user_id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Splash screens table
CREATE TABLE IF NOT EXISTS splash_screens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  enabled BOOLEAN DEFAULT TRUE,
  display_order INTEGER,
  duration_seconds INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## الخطوة 2: إعداد متغيرات البيئة المحلية

1. انسخ `.env.example` إلى `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. املأ قيم المتغيرات:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   NODE_ENV=development
   PORT=3000
   ```

## الخطوة 3: الاختبار المحلي

```bash
# تثبيت الحزم
pnpm install

# تشغيل الخادم للتطوير
pnpm dev

# بناء المشروع
pnpm build

# معاينة الإنتاج محليًا
pnpm preview
```

## الخطوة 4: النشر على Vercel

### 4.1 ربط المستودع بـ Vercel

1. اذهب إلى [vercel.com](https://vercel.com)
2. انقر على "New Project"
3. اختر المستودع `k231d/KING-DESIGNER`
4. انقر على "Import"

### 4.2 إضافة متغيرات البيئة

1. في صفحة الإعدادات، اذهب إلى **Environment Variables**
2. أضف المتغيرات:
   - `VITE_SUPABASE_URL`: قيمتها من Supabase
   - `VITE_SUPABASE_ANON_KEY`: قيمتها من Supabase
   - `NODE_ENV`: `production`

### 4.3 تكوين البناء والنشر

- **Build Command**: `pnpm build`
- **Output Directory**: `dist/public`
- **Install Command**: `pnpm install`

### 4.4 نشر المشروع

1. انقر على "Deploy"
2. انتظر اكتمال عملية البناء والنشر
3. ستحصل على URL للتطبيق (مثل: `https://king-designer.vercel.app`)

## الخطوة 5: تحديث Supabase CORS

1. في Supabase، اذهب إلى **Settings** → **API**
2. أضف اسم نطاق Vercel إلى **Allowed URLs**:
   ```
   https://king-designer.vercel.app
   ```

## الخطوة 6: إعداد التخزين (Storage Buckets)

في Supabase، اذهب إلى **Storage** وأنشئ Buckets التالية:

- `avatars`: للصور الشخصية
- `covers`: لصور الغلاف
- `media`: للوسائط العامة
- `messages-media`: لوسائط الرسائل
- `verifications`: لملفات التحقق
- `portfolio`: لملفات المحفظة

لكل bucket، تأكد من:
- جعل الوصول **Public**
- تفعيل **File upload** من العميل

## تحديث التطبيق بعد النشر

كل التزام على فرع `main` في GitHub سيؤدي إلى:
1. بناء تلقائي في Vercel
2. اختبار التطبيق
3. نشر تلقائي إلى الإنتاج

## استكشاف الأخطاء

### خطأ: "Cannot find module"
- تأكد من تشغيل `pnpm install`
- احذف `node_modules` و `pnpm-lock.yaml` وأعد التثبيت

### خطأ: "Supabase connection failed"
- تحقق من متغيرات البيئة في Vercel
- تأكد من أن URL و Key صحيحة
- تحقق من CORS settings في Supabase

### خطأ: "Storage bucket not found"
- تأكد من إنشاء جميع buckets المطلوبة
- تحقق من إعدادات الوصول (Public)

## الدعم والمساعدة

للحصول على مساعدة:
- [توثيق Vercel](https://vercel.com/docs)
- [توثيق Supabase](https://supabase.com/docs)
- [الإصدارات المتكررة](https://github.com/k231d/KING-DESIGNER/issues)
