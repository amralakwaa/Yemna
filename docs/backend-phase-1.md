# Yemna Backend — Phase 1 Foundation

هذه المرحلة تضيف أساساً فعلياً لـ **NestJS 11** داخل الخادم القائم، مع Prisma Schema خاص بـ PostgreSQL، ومصادقة JWT وRefresh Tokens قابلة للتشغيل فور ربط قاعدة PostgreSQL. لم تُربط صفحات React بالـAPI بعد؛ لذلك بقيت الواجهة الحالية دون تغيير بصري أو مساري.

| المكوّن | الحالة | الملاحظة |
|---|---|---|
| NestJS داخل Express القائم | جاهز | يُركّب قبل tRPC وVite ولا يبدل مسارات الواجهة |
| Swagger | جاهز | `GET /api/docs` |
| Health check | جاهز | `GET /health`، ويصرّح بحالة إعداد PostgreSQL بدقة |
| Prisma/PostgreSQL | مخطط + migration جاهزان | لا تُشغّل migration دون رابط PostgreSQL فعلي |
| حسابات وجلسات | جاهز في المصدر | تسجيل/دخول/تحديث/خروج/معلومات المستخدم عبر `/api/v1/auth/*` |
| JWT/RBAC | جاهز كأساس | `JwtAuthGuard` و`RolesGuard` و`@Roles()` |
| Redis/BullMQ ووسائط وWebSocket | مؤجلة للمرحلة التالية | تتطلب خدمة Redis/S3 فعلية ولا تعمل بمزود وهمي |

## متغيرات التشغيل المطلوبة

```bash
YEMNA_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/yemna?schema=public
YEMNA_JWT_ACCESS_SECRET=change-this-to-a-random-secret-of-at-least-32-characters
YEMNA_REDIS_URL=redis://HOST:6379
YEMNA_CORS_ORIGINS=https://your-frontend.example
```

`YEMNA_DATABASE_URL` مستقل عمداً عن `DATABASE_URL` الذي تستخدمه طبقة القالب الموروثة. هذا يمنع ربط Prisma الخاص بـPostgreSQL خطأً بقاعدة MySQL الخاصة بالقالب.

> Docker غير متاح في بيئة التطوير الحالية، لذلك لم يُزعم تشغيل PostgreSQL أو Redis محلياً. ملف Prisma Migration محفوظ ومراجعته ممكنة، لكن تطبيقه يحتاج خدمة PostgreSQL فعلية وبيانات وصول آمنة.

## نتيجة التحقق المحلي

تم فحص بيئة التطوير بحثاً عن عميل PostgreSQL أو خدمة تستمع على المنفذ `5432` أو عملية PostgreSQL. لم يوجد أي منها، ولذلك **لم يُنفذ** اختبار `SELECT 1` ولم تُطبّق أي Prisma migration. لا تعني عملية `prisma generate` اتصالاً بقاعدة بيانات؛ فهي تولّد العميل من المخطط محلياً فقط.

انسخ `.env.example` إلى `.env` في التطوير المحلي، أو عيّن `YEMNA_DATABASE_URL` عبر نظام Secrets في البيئة المستهدفة. لا تحفظ ملف `.env` ولا قيمة اتصال حقيقية في Git.
