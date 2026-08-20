# مصفوفة تدقيق مسارات واجهة يمنا

تستند هذه المصفوفة إلى خريطة المسارات الفعلية في `client/src/App.tsx`. غرضها إثبات وجود الشاشات التي طلبت في نطاق يمنا وتبيان ما إذا كانت تتصل حالياً بطبقة REST أو تبقى واجهة عرض تجريبية لحين مرحلة الربط التالية. لا تعني عبارة «واجهة موجودة» أن الشاشة ترسل بيانات حقيقية في كل تفاعل.

| النطاق المتخصص | المسارات الفعلية | حالة الواجهة | حالة الربط الحالي |
|---|---|---|---|
| الوصول والحساب | `/welcome`، `/onboarding`، `/login`، `/register`، `/verification`، `/forgot-password` | موجودة | التسجيل والدخول موصولان بـ `/api/v1/auth/*` |
| الملف والمحتوى | `/profile`، `/profile/:username`، `/profile/edit`، `/create/post`، `/post/1` | موجودة | التغذية والملف الحالي والملف العام موصولة؛ الإنشاء والتفاصيل المتقدمة تنتظر الربط |
| العلاقات | `/friends`، `/friends/mutual`، `/friend-requests`، `/followers`، `/following`، `/blocked`، `/friendship/manage` | موجودة | API العلاقات متاح؛ صفحات العرض لم تُربط كلها بعد |
| المحادثات والإشعارات | `/messages`، `/messages/new`، `/messages/chat`، `/messages/group`، `/notifications`، `/notifications/settings` | موجودة | APIs الرسائل والإشعارات متاحة؛ الواجهة مؤجلة لربط تدريجي |
| المجتمعات المحلية | `/communities`، `/communities/local`، `/communities/governorates`، `/communities/universities`، `/communities/interests`، `/communities/nearby`، `/community/*` | موجودة | API المجتمعات متاح؛ الواجهة مؤجلة لربط تدريجي |
| الدعم | `/help`، `/help/faq`، `/help/report`، `/help/report/status`، `/help/contact` | موجودة | API تذاكر الدعم والبلاغات متاح؛ الواجهة مؤجلة لربط تدريجي |
| الحساب والأمان | `/account`، `/account/info`، `/account/edit`، `/account/contact/*`، `/account/recovery`، `/account/disable`، `/account/delete` | موجودة | API الملف والإعدادات متاح؛ تدفقات الحساب التفصيلية مؤجلة |
| الوسائط والحفظ | `/media`، `/photos`، `/videos`، `/albums`، `/saved`، `/activity`، `/create/media`، `/create/video` | موجودة | API رفع الوسائط والألبومات متاح؛ الواجهة مؤجلة لربط تدريجي |
| البحث والاكتشاف | `/search`، `/search/advanced`، `/search/voice`، `/discover`، `/discover/map`، `/discover/interests` | موجودة | API البحث متاح؛ الواجهة مؤجلة لربط تدريجي |
| الإدارة والإشراف | `/admin`، `/admin/users`، `/admin/content`، `/admin/reports`، `/admin/analytics`، `/admin/logs`، `/admin/ai-analytics` | موجودة | API الإدارة محمي بدور `ADMIN`؛ واجهة البيانات الحية مؤجلة |
| الذكاء الاصطناعي | `/ai`، `/ai/assistant`، `/ai/post`، `/ai/summary`، `/ai/search`، `/ai/sentiment`، `/ai/recommendations`، `/ai/report` | موجودة | واجهات العرض موجودة؛ تكامل الخدمة الذكية خارج النطاق الحالي |
| Reels والبث والحالات | `/reels/*`، `/live/*`، `/states/*` | موجودة | واجهات العرض موجودة؛ البث والاتصال اللحظي يتطلبان WebSocket وبنية تشغيل مستمرة |

## مسارات الربط ذات الأولوية

التدفقات الثلاثة التالية تعمل على REST اليوم: إنشاء الحساب وتسجيل الدخول، قراءة تغذية المنشورات، والملف الشخصي للحساب الحالي أو العام. يستعمل العميل `client/src/lib/api.ts` رمز الوصول المحفوظ في المتصفح لإرسال `Authorization: Bearer` عند الحاجة. تحافظ الواجهات غير الموصولة على بنيتها المرئية بدلاً من ادعاء وجود مزامنة حقيقية.

| الأولوية التالية | سببها | API الخلفي المتاح |
|---|---|---|
| إنشاء المنشور والتفاعل والتعليق والحفظ | يكمل المسار الأكثر استخداماً بعد قراءة التغذية | `/api/v1/posts` ومسارات التعليقات والتفاعلات والحفظ |
| الرسائل والإشعارات | يحوّل التنقل اليومي إلى بيانات المستخدم الفعلية | `/api/v1/messages/*` و`/api/v1/notifications/*` |
| المجتمعات والعلاقات | يربط الاستكشاف والانضمام وإدارة الصلات | `/api/v1/communities/*` و`/api/v1/relationships/*` |
| الإدارة والدعم | يتطلب معالجة صلاحية ومسارات حالة واضحة | `/api/v1/admin/*` و`/api/v1/support/*` |

> لا توجد شاشة متخصصة من نطاق المجتمعات والعلاقات والدعم والحساب والوسائط والإدارة غير ممثلة بمسار فعلي في خريطة التطبيق الحالية. تبقى فجوة العمل هي **الربط ببيانات حية**، لا إضافة شاشات جديدة.

## سجل الفحص البصري للهاتف

أُجري الفحص التالي على عرض هاتف **375×812**. تعني «مرّ» أن المسار فتح الواجهة المتوقعة، وأن اتجاه RTL والعنوان والتنقل السفلي بقيا ظاهرين ضمن نافذة الفحص. لا يثبت الفحص أن المحتوى التجريبي أصبح بيانات حية.

| المجموعة | المسار المفحوص | النتيجة | ملاحظة موجزة |
|---|---|---|---|
| المجتمعات | `/communities` | مرّ | قائمة المجموعات والتبويبات ظاهرة بصورة سليمة. |
| المجتمعات | `/community/old-sanaa` | مرّ | صفحة مجتمع تفصيلية مع تبويب المنشورات وإجراء الانضمام. |
| المجتمعات | `/community/members` | مرّ | قائمة الأعضاء والمرشحات ظاهرة. |
| المجتمعات | `/communities/nearby` | مرّ | حالة طلب الموقع مع زر التفعيل سليمة. |
| المجتمعات | `/communities/governorates` | مرّ | قائمة المحافظات وإجراءات الانضمام ظاهرة. |
| العلاقات | `/friends/mutual` | مرّ | بطاقات الأصدقاء المشتركين قابلة للعرض. |
| العلاقات | `/friend-requests` | مرّ | قائمة الطلبات مع إجراءات التأكيد والحذف ظاهرة. |
| العلاقات | `/blocked` | مرّ | قائمة الحسابات المحظورة وإجراء إلغاء الحظر ظاهرة. |
| الدعم | `/help` | مرّ | مداخل الأسئلة والإبلاغ والحالة ظاهرة. |
| الدعم | `/help/faq` | مرّ | قائمة الأسئلة مع إجابة مفتوحة سليمة. |
| الدعم | `/help/report` | مرّ | نموذج الإبلاغ وحقوله الرئيسة ظاهرة. |
| الدعم | `/help/report/status` | مرّ | بطاقات حالة البلاغات ظاهرة. |
| الدعم | `/help/contact` | مرّ | قنوات التواصل والدعم العاجل ظاهرة. |
| الحساب | `/account` | مرّ | بوابة إدارة الحساب وبنودها ظاهرة. |
| الحساب | `/account/info` | مرّ | بيانات الحساب معروضة باتجاه RTL. |
| الحساب | `/account/delete` | مرّ | شاشة التحذير والتأكيد للحذف ظاهرة. |
| الوسائط والحفظ | `/media` | مرّ | بوابة الوسائط ظاهرة بتخطيط الهاتف. |
| الوسائط والحفظ | `/photos` | مرّ | شبكة الصور وأدوات العرض ظاهرة. |
| الوسائط والحفظ | `/videos` | مرّ | قائمة الفيديوهات مع عناصر التحكم ظاهرة. |
| الوسائط والحفظ | `/albums` | مرّ | بطاقات الألبومات وإجراء الإنشاء ظاهرة. |
| الوسائط والحفظ | `/saved` | مرّ | قائمة العناصر المحفوظة ظاهرة. |
| الوسائط والحفظ | `/activity` | مرّ | سجل النشاط قابل للعرض. |
| الحساب | `/account/edit` | مرّ | نموذج تعديل البيانات وزر الحفظ ظاهران. |
| الحساب | `/account/contact/email` | مرّ | نموذج تغيير البريد الإلكتروني ظاهر. |
| الحساب | `/account/recovery` | مرّ | خيارات الاستعادة مع مؤشرات التفعيل ظاهرة. |
| الحساب | `/account/disable` | مرّ | شاشة التعطيل المؤقت وخيار السبب ظاهران. |
| الإدارة | `/admin` | مرّ | لوحة الإدارة الرئيسة صالحة للعرض على الهاتف. |
| الإدارة | `/admin/users` | مرّ | قائمة المستخدمين والتبويب الإداري ظاهران. |
| الإدارة | `/admin/content` | مرّ | قائمة مراقبة المحتوى ظاهرة. |
| الإدارة | `/admin/reports` | مرّ | قائمة البلاغات وإجراءاتها ظاهرة. |
| الإدارة | `/admin/logs` | مرّ | سجل العمليات قابل للعرض. |
| الإدارة | `/admin/ai-analytics` | مرّ | بطاقات تحليلات الذكاء الاصطناعي ظاهرة. |
| المجتمعات | `/communities/local` | مرّ | قائمة المجتمعات القريبة وإجراءات الانضمام ظاهرة دون تجاوز أفقي. |
| المجتمعات | `/communities/universities` | مرّ | قائمة الجامعات وعناصر الانضمام متماسكة في عرض الهاتف. |
| المجتمعات | `/communities/interests` | مرّ | مجتمعات الاهتمامات والأيقونات وإجراءات الانضمام ظاهرة. |
| العلاقات | `/friends` | مرّ | قائمة الأصدقاء وتبويبات العلاقة ظاهرة باتجاه RTL. |
| العلاقات | `/followers` | مرّ | قائمة المتابعين والبحث والإجراءات قابلة للعرض. |
| العلاقات | `/following` | مرّ | قائمة الحسابات المتابَعة وإجراءات المتابعة ظاهرة. |
| العلاقات | `/friendship/manage` | مرّ | خيارات إدارة العلاقة والحظر منظمة ضمن عرض الهاتف. |
| الحساب | `/account/contact/phone` | مرّ | نموذج تغيير الهاتف وخطوة التحقق ظاهران ضمن الإطار. |
| الإدارة | `/admin/analytics` | مرّ | بطاقات مؤشرات التحليل ومناطق البيانات معروضة داخل إطار الهاتف. |
| العلاقات | `/friends` | مرّ | قائمة الأصدقاء وتبويبات العلاقة ظاهرة باتجاه RTL. |
| العلاقات | `/friends/mutual` | مرّ | بطاقات الأصدقاء المشتركين وإجراء عرض الملف سليمة. |
| العلاقات | `/friend-suggestions` | مرّ | بطاقات الاقتراح وأزرار الإضافة متماسكة في عرض الهاتف. |
| العلاقات | `/followers` | مرّ | قائمة المتابعين والبحث والإجراءات قابلة للعرض. |
| العلاقات | `/following` | مرّ | قائمة الحسابات المتابَعة وإجراءات المتابعة ظاهرة. |
| العلاقات | `/friend-requests` | مرّ | قائمة الطلبات وإجراءات التأكيد والحذف ظاهرة. |
| العلاقات | `/friendship/manage` | مرّ | خيارات إدارة العلاقة والحظر منظمة ضمن عرض الهاتف. |
| العلاقات | `/blocked` | مرّ | قائمة الحسابات المحظورة وإجراء إلغاء الحظر ظاهرة. |

| الرسائل | `/messages` | مرّ | تظهر حالة وصول صريحة للمستخدم غير المصادق مع زر تسجيل الدخول دون قصّ أفقي. |
| الرسائل | `/messages/new` | مرّ | قائمة اقتراحات بدء محادثة وزر البدء متماسكان في عرض الهاتف. |
| الرسائل | `/messages/chat` | مرّ | فقاعات المحادثة والتنقل الأساسي ظاهرة ضمن إطار الهاتف. |
| الرسائل | `/messages/info` | مرّ | معلومات المحادثة وإجراءات الاتصال والوسائط منظمة. |
| الرسائل | `/messages/group` | مرّ | واجهة المجموعة وحقل إدخال الرسالة ظاهران دون تجاوز. |
| الرسائل | `/messages/group/create` | مرّ | نموذج إنشاء المجموعة وقائمة اختيار الأعضاء معروضان بصورة سليمة. |
| الإشعارات | `/notifications` | مرّ | تظهر حالة وصول صريحة للمستخدم غير المصادق مع زر تسجيل الدخول. |
| الإشعارات | `/notifications/settings` | مرّ | مفاتيح إعدادات الإشعارات وطرق التسليم ظاهرة وقابلة للعرض. |

| الحساب | `/account` | مرّ | لوحة إدارة الحساب وروابط الإجراءات الحساسة ظاهرة ضمن إطار الهاتف. |
| الحساب | `/account/info` | مرّ | بطاقة بيانات الحساب وحقول الاتصال المنظمة ظاهرة. |
| الحساب | `/account/edit` | مرّ | نموذج تعديل الاسم والمعرّف والنبذة وزر الحفظ ظاهر دون تجاوز. |
| الحساب | `/account/contact/email` | مرّ | نموذج تغيير البريد وخطوة التحقق ظاهران بوضوح. |
| الحساب | `/account/contact/phone` | مرّ | نموذج تغيير الهاتف وخطوة التحقق ظاهران بوضوح. |
| الحساب | `/account/recovery` | مرّ | خيارات الاسترداد وحالة التفعيل قابلة للقراءة. |
| الحساب | `/account/disable` | مرّ | إجراء التعطيل المؤقت وتفسيره معروضان بوضوح. |
| الحساب | `/account/delete` | مرّ | تأكيد الحذف التحذيري وحقل العبارة وزر المتابعة ظاهرة. |

| الدعم | `/help` | مرّ | مركز المساعدة والبحث وروابط الأسئلة والبلاغات داخل إطار الهاتف. |
| الدعم | `/help/faq` | مرّ | عناصر الأسئلة الشائعة القابلة للتوسيع قابلة للقراءة. |
| الدعم | `/help/report` | مرّ | نموذج البلاغ ونوع المشكلة والوصف وزر الإرسال ظاهرة. |
| الدعم | `/help/report/status` | مرّ | بطاقات حالة البلاغات وحالاتها مميزة وواضحة. |
| الدعم | `/help/contact` | مرّ | قنوات التواصل مع الدعم وطريقة التصعيد ظاهرة بوضوح. |
| الوسائط والحفظ | `/photos` | مرّ | شبكة الصور داخل حدود الهاتف دون قص أفقي. |
| الوسائط والحفظ | `/videos` | مرّ | شبكة الفيديو وعلامات التشغيل ظاهرة ومتوازنة. |
| الوسائط والحفظ | `/saved` | مرّ | شاشة المحفوظات وشبكة العناصر قابلة للعرض دون تجاوز. |

## خلاصة نطاقات الإغلاق 13–18

يشمل سجل الهاتف أعلاه كل الفئات المتخصصة المطلوبة عند إغلاق نطاق الواجهات: **المجتمعات المحلية، العلاقات المتقدمة، المساعدة والدعم، الحساب، الوسائط والحفظ، ولوحات الإدارة المتقدمة**. لكل فئة مسار فعلي واحد على الأقل لكل شاشة وظيفية مطلوبة، وكانت نتيجة العرض ضمن نافذة `375×812` هي «مرّ». تبقى بيانات العرض التجريبية في الصفحات التي لم تُربط بعد بطبقة REST؛ هذه المصفوفة لا تقدم ذلك على أنه اتصال بيانات حي.

## مطابقة الإغلاق: المسار لكل شاشة مطلوبة (13–18)

يقتصر هذا الملحق على **الشاشات المتخصصة التي طُلبت صراحةً ضمن البنود 13–18**، لا على جميع صفحات المنتج الثانوية مثل الـ Reels أو صفحات الأدوات المساعدة. كل مسار أدناه موجود كتعريف صريح في `client/src/App.tsx`، ومرّ بفحص الهاتف المسجل في الجدول السابق.

| النطاق | الشاشة المطلوبة | المسار الفعلي | حالة الفحص |
|---|---|---|---|
| 13: المجتمعات | المحافظات والمدن | `/communities/governorates` | مرّ |
| 13: المجتمعات | المجتمعات المحلية | `/communities/local` | مرّ |
| 13: المجتمعات | الجامعات | `/communities/universities` | مرّ |
| 13: المجتمعات | الاهتمامات | `/communities/interests` | مرّ |
| 13: المجتمعات | اكتشاف مجتمع قريب | `/communities/nearby` | مرّ |
| 13: المجتمعات | صفحة المجتمع | `/community/old-sanaa` | مرّ |
| 13: المجتمعات | أعضاء المجتمع | `/community/members` | مرّ |
| 14: العلاقات | اقتراحات الأصدقاء | `/friend-suggestions` | مرّ |
| 14: العلاقات | الأصدقاء المشتركون | `/friends/mutual` | مرّ |
| 14: العلاقات | المتابعون | `/followers` | مرّ |
| 14: العلاقات | المتابَعون | `/following` | مرّ |
| 14: العلاقات | طلبات الصداقة | `/friend-requests` | مرّ |
| 14: العلاقات | إدارة العلاقة | `/friendship/manage` | مرّ |
| 14: العلاقات | الحظر وإلغاء الحظر | `/blocked` | مرّ |
| 15: الدعم | مركز المساعدة | `/help` | مرّ |
| 15: الدعم | الأسئلة الشائعة | `/help/faq` | مرّ |
| 15: الدعم | الإبلاغ عن مشكلة | `/help/report` | مرّ |
| 15: الدعم | حالة البلاغ | `/help/report/status` | مرّ |
| 15: الدعم | التواصل مع الدعم | `/help/contact` | مرّ |
| 16: الحساب | معلومات الحساب | `/account/info` | مرّ |
| 16: الحساب | تعديل البيانات | `/account/edit` | مرّ |
| 16: الحساب | تغيير البريد | `/account/contact/email` | مرّ |
| 16: الحساب | تغيير الهاتف | `/account/contact/phone` | مرّ |
| 16: الحساب | استعادة الحساب | `/account/recovery` | مرّ |
| 16: الحساب | تعطيل الحساب | `/account/disable` | مرّ |
| 16: الحساب | حذف الحساب | `/account/delete` | مرّ |
| 17: الوسائط والحفظ | الصور | `/photos` | مرّ |
| 17: الوسائط والحفظ | الفيديوهات | `/videos` | مرّ |
| 17: الوسائط والحفظ | العناصر المحفوظة | `/saved` | مرّ |
| 17: الوسائط والحفظ | الألبومات | `/albums` | مرّ |
| 17: الوسائط والحفظ | سجل النشاط | `/activity` | مرّ |
| 18: الإدارة | لوحة الإحصاءات | `/admin` | مرّ |
| 18: الإدارة | تحليل البلاغات | `/admin/reports` | مرّ |
| 18: الإدارة | مراقبة المستخدمين | `/admin/users` | مرّ |
| 18: الإدارة | مراقبة المحتوى | `/admin/content` | مرّ |
| 18: الإدارة | سجلات الأمان | `/admin/logs` | مرّ |
| 18: الإدارة | تحليلات استخدام الذكاء الاصطناعي | `/admin/ai-analytics` | مرّ |

## سجل المسارات الناقصة أو المكسورة تاريخياً

| المسار أو المجال | المشكلة المرصودة | الإصلاح المنفذ | دليل التحقق الحالي |
|---|---|---|---|
| `/messages` و`/notifications` | كان معالج NestJS الشامل يعترض عرض Vite فتظهر استجابة 404 في المعاينة. | عُزلت مسارات NestJS تحت البادئة `/api` في نقطة تشغيل الخادم. | فحصت الصفحتان لاحقاً على الهاتف وسجلتا «مرّ»؛ وتعمل مسارات REST تحت `/api/v1/*`. |
| `/communities` | أعاد طلب القائمة خطأ 500 بسبب عدم حقن خدمة المجتمعات صراحةً في المتحكم. | ثُبّت حقن `CommunitiesService` في `CommunitiesController`. | تحقق طلب القائمة بعد الإصلاح، ثم مرّ الفحص البصري للصفحة. |
| `/communities` على الهاتف | لم يكن تباين نص زر «إنشاء مجتمع» مستقراً على الخلفية العنابية. | أضيف تنسيق معزول يفرض لون النص المناسب في `community-button-fix.css`. | مرّ فحص الهاتف اللاحق للزر والصفحة. |
| `/admin/stats` | ظهر خطأ 500 بعد اجتياز حارس الأدوار بسبب حقن غير صريح لخدمة الإدارة. | ثُبّت حقن `AdminService` في المتحكم. | اجتاز اختبار HTTP للمصادقة وRBAC مع طلب إداري برمز صالح. |

> **قرار الإغلاق:** لا توجد شاشة متخصصة مطلوبة ضمن نطاق 13–18 بلا مسار فعلي أو بلا نتيجة فحص مرئية مسجلة. هذا القرار لا يغيّر حالة صفحات العرض التجريبية غير الموصولة بعد ببيانات REST؛ يوضح فقط اكتمال المسارات والشاشات المطلوبة والتحقق المرئي منها.

## مصفوفة التدقيق الفردية الكاملة

تسجل هذه المصفوفة جميع تعريفات المسارات الموجودة في `client/src/App.tsx` وقت المراجعة. تعني **مرئي** أن المسار فُتح في معاينة هاتفية بعرض `375×812` أثناء هذه المراجعة، وتعني **مراجعة تعريف** أن تعريف `Route` روجع صراحةً لكن الشاشة تشارك مكوّناً مع مسار ممثل فُحص مرئياً. أما **قالب بيانات** فيخص المسارات الديناميكية التي تحتاج قيمة فعلية لاختبار معنى المحتوى، مع بقاء تعريف الموجّه مؤكداً. لا تساوي أي من هذه الحالات ربط البيانات الحية ما لم يذكر ذلك صراحة في قسم حالة الربط.

| المجال | المسار الفردي | المكوّن/نوع التعريف | نتيجة التدقيق |
|---|---|---|---|
| الرئيسية | `/` | `HomePage` | مرئي |
| الوصول | `/welcome` | `WelcomePage` | مرئي |
| الوصول | `/onboarding` | `OnboardingPage` | مرئي |
| الوصول | `/login` | `LoginPage` | مرئي — REST للمصادقة متاح |
| الوصول | `/register` | `RegisterPage` | مرئي — REST للمصادقة متاح |
| الوصول | `/verification` | `VerificationPage` | مرئي |
| الوصول | `/forgot-password` | `ForgotPasswordPage` | مرئي |
| الملف | `/profile` | `ProfileDetailPage` | مرئي — REST للملف متاح |
| الملف | `/profile/edit` | `EditProfilePage` | مرئي |
| الملف | `/profile/:username` | `ProfileDetailPage` | قالب بيانات؛ تعريف صريح وREST للملف العام متاح |
| ملف ومحتوى | `/my-posts` | `ProfileCollectionPage` | مرئي |
| ملف ومحتوى | `/saved` | `ProfileCollectionPage` | مرئي |
| ملف ومحتوى | `/albums` | `ProfileCollectionPage` | مرئي |
| ملف ومحتوى | `/photos` | `ProfileCollectionPage` | مرئي |
| ملف ومحتوى | `/videos` | `ProfileCollectionPage` | مرئي |
| ملف ومحتوى | `/activity` | `ProfileCollectionPage` | مرئي |
| ملف ومحتوى | `/memories` | `ProfileCollectionPage` | مرئي |
| المحتوى | `/story` | `StoryPage` | مرئي |
| المحتوى | `/story/create` | `CreateStoryPage` | مرئي |
| المحتوى | `/post/1` | `PostDetailPage` | مرئي |
| المحتوى | `/post/options` | `PostOptionsPage` | مرئي |
| المحتوى | `/post/report` | `ReportPostPage` | مرئي |
| المحتوى | `/share` | `LibraryUtilityPage` | مرئي |
| المحتوى | `/create` | `CreatePage` | مرئي |
| المحتوى | `/create/post` | `CreatePostDetailPage` | مرئي |
| المحتوى | `/create/media` | `CreateMediaPage` | مرئي |
| المحتوى | `/media/editor` | `ImageEditorPage` | مرئي |
| المحتوى | `/create/video` | `UploadVideoPage` | مرئي |
| العلاقات | `/friends` | `FriendsPage` | مرئي سابقاً في سجل الهاتف |
| العلاقات | `/friends/mutual` | `RelationsCompletionPage` | مرئي سابقاً في سجل الهاتف |
| العلاقات | `/friendship/manage` | `RelationsCompletionPage` | مرئي سابقاً في سجل الهاتف |
| العلاقات | `/blocked/unblock` | `RelationsCompletionPage` | مرئي |
| العلاقات | `/blocked` | `RelationsCompletionPage` | مرئي سابقاً في سجل الهاتف |
| العلاقات | `/friend-requests` | `RelationsDetailPage` | مرئي سابقاً في سجل الهاتف |
| العلاقات | `/followers` | `RelationsDetailPage` | مرئي سابقاً في سجل الهاتف |
| العلاقات | `/following` | `RelationsDetailPage` | مرئي سابقاً في سجل الهاتف |
| العلاقات | `/people/discover` | `RelationsDetailPage` | مرئي |
| العلاقات | `/friend-suggestions` | `FriendSuggestionsPage` | مرئي سابقاً في سجل الهاتف |
| الرسائل | `/messages` | `RealtimeMessagesPage` | مرئي سابقاً؛ يتطلب جلسة لبيانات حية |
| الرسائل | `/messages/new` | `NewMessagePage` | مرئي سابقاً في سجل الهاتف |
| الرسائل | `/messages/chat` | `ChatDetailPage` | مرئي سابقاً في سجل الهاتف |
| الرسائل | `/messages/info` | `ChatInfoPage` | مرئي سابقاً في سجل الهاتف |
| الرسائل | `/messages/group` | `GroupChatPage` | مرئي سابقاً في سجل الهاتف |
| الرسائل | `/messages/group/create` | `CreateGroupChatPage` | مرئي سابقاً في سجل الهاتف |
| المكالمات | `/calls` | `CallHistoryPage` | مرئي |
| المكالمات | `/call/incoming` | `CallPage` | مرئي |
| المكالمات | `/call/active` | `CallPage` | مرئي |
| الإشعارات | `/notifications` | `RealtimeNotificationsPage` | مرئي سابقاً؛ يتطلب جلسة لبيانات حية |
| الإشعارات | `/notifications/settings` | `NotificationSettingsPage` | مرئي سابقاً في سجل الهاتف |
| الدليل | `/groups` | `DirectoryPage` | مرئي |
| الدليل | `/groups/create` | `CreatePageEntity` | مرئي |
| الدليل | `/pages` | `DirectoryPage` | مرئي |
| الدليل | `/pages/create` | `CreatePageEntity` | مرئي |
| الدليل | `/pages/manage` | `PageManagementPage` | مرئي |
| المجتمعات | `/communities` | `CommunitiesPage` | مرئي سابقاً؛ REST للقائمة متاح |
| المجتمعات | `/communities/local` | `CommunityExplorerPage` | مرئي سابقاً في سجل الهاتف |
| المجتمعات | `/communities/governorates` | `CommunityExplorerPage` | مرئي سابقاً في سجل الهاتف |
| المجتمعات | `/communities/universities` | `CommunityExplorerPage` | مرئي سابقاً في سجل الهاتف |
| المجتمعات | `/communities/interests` | `CommunityExplorerPage` | مرئي سابقاً في سجل الهاتف |
| المجتمعات | `/communities/nearby` | `NearbyCommunityPage` | مرئي سابقاً في سجل الهاتف |
| المجتمعات | `/communities/notifications` | `CommunityExtraPage` | مرئي |
| المجتمعات | `/communities/search` | `CommunityExtraPage` | مرئي |
| المجتمعات | `/communities/location` | `CommunityExtraPage` | مرئي |
| المجتمع | `/community/old-sanaa` | `CommunityDetailPage` | مرئي سابقاً في سجل الهاتف |
| المجتمع | `/community/sanaa` | `CommunityDetailPage` | مرئي |
| المجتمع | `/community/page` | `CommunityDetailPage` | مرئي |
| الصفحة | `/page/yemna` | `CommunityDetailPage` | مرئي |
| المجتمع | `/community/create` | `CreateCommunityPage` | مرئي |
| المجتمع | `/community/join` | `JoinCommunityPage` | مرئي |
| المجتمع | `/community/members` | `CommunityMembersPage` | مرئي سابقاً في سجل الهاتف |
| المجتمع | `/community/manage` | `CommunityManagePage` | مرئي |
| المجتمع | `/community/info` | `CommunityInfoPage` | مرئي |
| البحث | `/search` | `LiveSearchPage` | مرئي — REST حي تم اختباره بعد إصلاح الحقن |
| البحث | `/search/advanced` | `AdvancedSearchPage` | مرئي |
| البحث | `/search/voice` | `VoiceSearchPage` | مرئي |
| الاكتشاف | `/discover` | `DiscoverPage` | مرئي |
| الاكتشاف | `/discover/map` | `DiscoverMapPage` | مرئي |
| الاكتشاف | `/discover/interests` | `InterestsPage` | مرئي |
| الوسائط | `/media` | `MediaPage` | مرئي |
| Reels | `/reels` | `ReelsPage` | مرئي |
| Reels | `/reels/view` | `ReelViewerPage` | مرئي |
| Reels | `/reels/create` | `ReelCreatePage` | مرئي |
| Reels | `/reels/audio` | `ReelsAudioPage` | مرئي |
| Reels | `/reels/edit` | `MediaExtraPage` | مرئي |
| Reels | `/reels/categories` | `MediaExtraPage` | مرئي |
| البث المباشر | `/live` | `LivePage` | مرئي |
| البث المباشر | `/live/view` | `LiveViewerPage` | مرئي |
| البث المباشر | `/live/create` | `LiveCreatePage` | مرئي |
| البث المباشر | `/live/info` | `MediaExtraPage` | مرئي |
| البث المباشر | `/live/active` | `MediaExtraPage` | مرئي |
| البث المباشر | `/live/previous` | `MediaExtraPage` | مرئي |
| الفعاليات | `/events` | `EventsPage` | مرئي |
| الفعاليات | `/events/1` | `EventsPage` | مرئي |
| الفعاليات | `/events/create` | `EventsPage` | مرئي |
| الأدوات | `/files` | `LibraryUtilityPage` | مرئي |
| الدعم | `/help` | `SupportSuitePage` | مرئي سابقاً في سجل الهاتف |
| الدعم | `/help/faq` | `SupportSuitePage` | مرئي سابقاً في سجل الهاتف |
| الدعم | `/help/report` | `SupportSuitePage` | مرئي سابقاً في سجل الهاتف |
| الدعم | `/help/report/status` | `SupportSuitePage` | مرئي سابقاً في سجل الهاتف |
| الدعم | `/help/contact` | `SupportSuitePage` | مرئي سابقاً في سجل الهاتف |
| الحساب | `/account` | `AccountSuitePage` | مرئي سابقاً في سجل الهاتف |
| الحساب | `/account/info` | `AccountSuitePage` | مرئي سابقاً في سجل الهاتف |
| الحساب | `/account/edit` | `AccountSuitePage` | مرئي سابقاً في سجل الهاتف |
| الحساب | `/account/contact/email` | `AccountSuitePage` | مرئي سابقاً في سجل الهاتف |
| الحساب | `/account/contact/phone` | `AccountSuitePage` | مرئي سابقاً في سجل الهاتف |
| الحساب | `/account/recovery` | `AccountSuitePage` | مرئي سابقاً في سجل الهاتف |
| الحساب | `/account/disable` | `AccountSuitePage` | مرئي سابقاً في سجل الهاتف |
| الحساب | `/account/delete` | `AccountSuitePage` | مرئي سابقاً في سجل الهاتف |
| الأدوات | `/more` | `MorePage` | مرئي |
| الإعدادات | `/settings` | `SettingsPage` | مرئي |
| الإعدادات | `/settings/privacy` | `SettingsDetailPage` | مرئي |
| الإعدادات | `/settings/security` | `SettingsDetailPage` | مرئي |
| الإعدادات | `/settings/sessions` | `SettingsDetailPage` | مرئي |
| الإعدادات | `/settings/notifications` | `SettingsDetailPage` | مرئي |
| الإعدادات | `/settings/data` | `SettingsDetailPage` | مرئي |
| الذكاء الاصطناعي | `/ai` | `AIHubPage` | مرئي |
| الذكاء الاصطناعي | `/ai/assistant` | `AIToolDetailPage` | مرئي |
| الذكاء الاصطناعي | `/ai/post` | `AIToolDetailPage` | مرئي |
| الذكاء الاصطناعي | `/ai/summary` | `AIToolDetailPage` | مرئي |
| الذكاء الاصطناعي | `/ai/search` | `AIToolDetailPage` | مرئي |
| الذكاء الاصطناعي | `/ai/sentiment` | `AIToolDetailPage` | مرئي |
| الذكاء الاصطناعي | `/ai/recommendations` | `AIToolDetailPage` | مرئي |
| الذكاء الاصطناعي | `/ai/report` | `AIToolDetailPage` | مرئي |
| الذكاء الاصطناعي | `/ai/friends` | `ExtraAIPage` | مرئي |
| الذكاء الاصطناعي | `/ai/comments` | `ExtraAIPage` | مرئي |
| الذكاء الاصطناعي | `/ai/classify` | `ExtraAIPage` | مرئي |
| الذكاء الاصطناعي | `/ai/writer` | `ExtraAIPage` | مرئي |
| الإدارة | `/admin/ai-analytics` | `AIUsageAnalyticsPage` | مرئي سابقاً في سجل الهاتف |
| الإدارة | `/admin` | `AdminDetailPage` | مرئي |
| الإدارة | `/admin/users` | `AdminDetailPage` | مرئي سابقاً في سجل الهاتف |
| الإدارة | `/admin/content` | `AdminDetailPage` | مرئي سابقاً في سجل الهاتف |
| الإدارة | `/admin/reports` | `AdminDetailPage` | مرئي سابقاً في سجل الهاتف |
| الإدارة | `/admin/groups` | `AdminDetailPage` | مرئي |
| الإدارة | `/admin/pages` | `AdminDetailPage` | مرئي |
| الإدارة | `/admin/analytics` | `AdminDetailPage` | مرئي سابقاً في سجل الهاتف |
| الإدارة | `/admin/logs` | `AdminDetailPage` | مرئي سابقاً في سجل الهاتف |
| الإدارة | `/admin/roles` | `AdminDetailPage` | مرئي |
| الإدارة | `/admin/system` | `AdminDetailPage` | مرئي |
| الإدارة | `/admin/login` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/messages` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/announcement` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/updates` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/backup` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/maintenance` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/profile` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/user/detail` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/report/detail` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/content/review` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/group/detail` | `AdminExtraPage` | مرئي |
| الإدارة | `/admin/page/detail` | `AdminExtraPage` | مرئي |
| الحالات | `/states` | `StatesDetailPage` | مرئي |
| الحالات | `/states/loading` | `StatesDetailPage` | مرئي |
| الحالات | `/states/empty` | `StatesDetailPage` | مرئي |
| الحالات | `/states/error` | `StatesDetailPage` | مرئي |
| الحالات | `/states/offline` | `StatesDetailPage` | مرئي |
| الحالات | `/states/no-results` | `StatesDetailPage` | مرئي |
| الحالات | `/states/blocked` | `StatesDetailPage` | مرئي |
| الحالات | `/states/deleted` | `StatesDetailPage` | مرئي |
| الحالات | `/states/upload-image` | `StatesDetailPage` | مرئي |
| الحالات | `/states/upload-video` | `StatesDetailPage` | مرئي |
| الحالات | `/states/post-unavailable` | `StatesDetailPage` | مرئي |
| الحالات | `/states/user-not-found` | `StatesDetailPage` | مرئي |

## نتيجة المراجعة الموسعة

لا يوجد في `App.tsx` تعريف مسار صريح خارج المصفوفة السابقة. النتيجة الدقيقة هي أن **كل مسار ثابت معرّف مغطّى بفحص هاتفي مرئي**، وأن مسار الملف الديناميكي موثق كقالب موجه مع REST متاح للملف العام. لم يعثر الفحص على انتقال إلى صفحة «غير موجودة» ضمن المسارات المفتوحة مرئياً. وتظل المصادقة وصلاحيات الإدارة ومحتوى البيانات الحية مشروطة بجلسة ورمز صالحين، وهو أمر لا تدّعيه هذه المراجعة المرئية.

| الإضافة إلى سجل التاريخ | المشكلة | المعالجة | التحقق |
|---|---|---|---|
| `/search` وأنواع البحث الثلاثة | كان `SearchController` لا يحقن `SearchService`، فيفشل الطلب بخطأ 500. كما كانت الاستجابة المفلترة قد تخلو من قوائم تتوقعها الصفحة. | أضيف حقن صريح للخدمة، ووحّد عقد الاستجابة ليحمل مفاتيح القوائم في جميع أنواع البحث، مع حماية عرض الواجهة. | اختبار متحكم ووحدات لخدمة البحث، والتحقق الحي من أنواع `all` و`users` و`posts` و`communities`، ثم فحص هاتف لمسار `/search`. |
