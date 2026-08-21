# Yemna Backend — Phase 1 Foundation

هذه المرحلة تضيف أساساً فعلياً لـ **NestJS 11** داخل الخادم القائم، مع Prisma Schema خاص بـ PostgreSQL، ومصادقة JWT وRefresh Tokens. اتصلت بيئة التشغيل بقاعدة PostgreSQL عبر السر المخصص للبيئة، وطُبقت الترحيلات المنفذة للمصادقة والمحتوى والعلاقات والمجتمعات والرسائل والإشعارات والوسائط والدعم. رُبطت صفحة التسجيل وتسجيل الدخول والتغذية والملف الشخصي بواجهات REST دون تغيير الهوية المرئية أو المسارات العامة.

| المكوّن | الحالة | الملاحظة |
|---|---|---|
| NestJS داخل Express القائم | جاهز | يُركّب قبل tRPC وVite ولا يبدل مسارات الواجهة |
| Swagger | جاهز | `GET /api/docs` |
| Health check | جاهز | `GET /api/health`، ويصرّح بحالة اتصال PostgreSQL بدقة |
| Prisma/PostgreSQL | متصل ومرحل | الترحيلات `0001` حتى `0005` مطبقة على قاعدة PostgreSQL المهيأة في Secrets |
| حسابات وجلسات | جاهز في المصدر | تسجيل/دخول/تحديث/خروج/معلومات المستخدم عبر `/api/v1/auth/*` |
| JWT/RBAC | جاهز كأساس | `JwtAuthGuard` و`RolesGuard` و`@Roles()` |
| Redis/BullMQ وWebSocket | مؤجلان | يتطلبان خدمة Redis وتشغيلاً مستمراً مناسباً قبل تفعيل الميزات اللحظية والمهام الخلفية |

## متغيرات التشغيل المطلوبة

```bash
YEMNA_DATABASE_URL=<يُحفظ رابط الاتصال في Secrets فقط>
YEMNA_JWT_ACCESS_SECRET=change-this-to-a-random-secret-of-at-least-32-characters
YEMNA_REDIS_URL=redis://HOST:6379
YEMNA_CORS_ORIGINS=https://your-frontend.example
```

`YEMNA_DATABASE_URL` مستقل عمداً عن `DATABASE_URL` الذي تستخدمه طبقة القالب الموروثة. هذا يمنع ربط Prisma الخاص بـPostgreSQL خطأً بقاعدة MySQL الخاصة بالقالب.

> لا تُعرض قيمة رابط قاعدة البيانات أو أسرار JWT في الوثائق أو السجل أو Git. تُدار هذه القيم عبر Secrets فقط، ويمكن تبديل رابط PostgreSQL دون تغيير كود التطبيق.

## نتيجة التحقق المحلي

تم التحقق من الاتصال الفعلي بقاعدة PostgreSQL، وتطبيق الترحيلات، واختبار إنشاء وقراءة وتنظيف سجل مستخدم عبر Prisma. كما اجتاز فحص HTTP التشغيلي الحالي `GET /api/health` بحالة `200`، و`GET /api/v1/posts?limit=5` بحالة `200`، بينما يُرفض `GET /api/v1/admin/stats` بلا Bearer token بحالة `401` كما يجب.

انسخ `.env.example` إلى `.env` في التطوير المحلي، أو عيّن `YEMNA_DATABASE_URL` عبر نظام Secrets في البيئة المستهدفة. لا تحفظ ملف `.env` ولا قيمة اتصال حقيقية في Git.
