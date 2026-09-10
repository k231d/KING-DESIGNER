# 👑 King Designer

> للتصميم ملوك ونحن اصحاب المملكة

تطبيق ويب اجتماعي حديث مبني بـ React و Supabase وVite.

## المميزات ✨

- 🔐 **المصادقة الآمنة**: تسجيل دخول وتسجيل حساب مع Supabase Auth
- 👥 **إدارة الملفات الشخصية**: إنشاء وتحرير ملفات شخصية متقدمة
- 💬 **نظام الرسائل**: رسائل فورية مع الأصدقاء
- 📢 **المنشورات والمشاركات**: إنشاء ومشاركة المحتوى
- 🔔 **الإشعارات**: نظام إشعارات في الوقت الفعلي
- 👫 **إدارة الأصدقاء**: طلبات الصداقة والإدارة
- 🔍 **البحث المتقدم**: ابحث عن المستخدمين والمحتوى
- 🌙 **وضع مظلم**: دعم كامل للوضع الليلي
- 🌍 **دعم اللغات**: واجهة متعددة اللغات
- 📱 **تصميم مستجيب**: يعمل على جميع الأجهزة

## المتطلبات 📋

- Node.js 18+
- pnpm 10+
- حساب Supabase
- حساب Vercel (للنشر)

## التثبيت المحلي 🚀

### 1. استنساخ المستودع

```bash
git clone https://github.com/k231d/KING-DESIGNER.git
cd KING-DESIGNER
```

### 2. تثبيت الحزم

```bash
pnpm install
```

### 3. إعداد متغيرات البيئة

```bash
cp .env.example .env.local
```

ثم عدّل `.env.local` بقيم Supabase الخاصة بك:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. تشغيل الخادم للتطوير

```bash
pnpm dev
```

سيتم فتح التطبيق على `http://localhost:3000`

## الأوامر المتاحة 📝

```bash
# تشغيل الخادم للتطوير
pnpm dev

# بناء للإنتاج
pnpm build

# معاينة الإنتاج محليًا
pnpm preview

# فحص الأخطاء
pnpm check

# تنسيق الأكواد
pnpm format
```

## هيكل المشروع 📁

```
.
├── App.tsx                 # المكون الرئيسي
├── main.tsx               # نقطة الدخول
├── supabase.ts            # إعدادات Supabase
├── index.html             # HTML الرئيسي
├── index.css              # الأنماط العامة
├── package.json           # تكوين المشروع
├── vite.config.ts         # إعدادات Vite
├── tailwind.config.js     # إعدادات Tailwind CSS
├── tsconfig.json          # إعدادات TypeScript
└── server/                # خادم Express للإنتاج
    └── index.ts
```

## التكنولوجيا المستخدمة 🛠️

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Backend/Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS 4 + Radix UI
- **Animation**: Framer Motion
- **Forms**: React Hook Form + Zod
- **Routing**: Wouter
- **State Management**: React Context
- **Server**: Express.js

## النشر 🌐

اتبع [دليل النشر الكامل](./DEPLOYMENT.md) لنشر التطبيق على Vercel مع Supabase.

## المساهمة 🤝

نرحب بالمساهمات! يرجى:

1. عمل Fork للمستودع
2. إنشاء فرع للميزة (`git checkout -b feature/AmazingFeature`)
3. Commit التغييرات (`git commit -m 'Add AmazingFeature'`)
4. Push إلى الفرع (`git push origin feature/AmazingFeature`)
5. فتح Pull Request

## الترخيص 📄

هذا المشروع مرخص تحت MIT License. انظر ملف [LICENSE](LICENSE) للتفاصيل.

## الدعم 💪

إذا واجهت مشاكل:

1. تحقق من [الأسئلة الشائعة](./FAQ.md)
2. ابحث في [Issues](https://github.com/k231d/KING-DESIGNER/issues)
3. أنشئ issue جديد مع التفاصيل الكاملة

---

**صُنع بـ ❤️ من قبل الفريق**
