# البيئة المحلية للتطوير — Local Dev Notes

## المشكلة المعروفة: Gradle محجوب على هذا الجهاز

Windows **Controlled Folder Access** (حماية برامج الفدية في Windows Security) يمنع
`java.exe` من الكتابة في مجلدات Gradle، فيفشل أي build محلي برسالة مثل:

```
Could not create service of type FileHasher ... java.io.IOException: Access is denied
```

**والأخطر: `git commit` محجوب أيضاً** — CFA يمنع `git.exe` من الكتابة في `.git\`
(مؤكد من سجل أحداث Defender، Event ID 1123، بتاريخ 2026-07-03):

```
C:\Program Files\Git\mingw64\bin\git.exe has been blocked from modifying
%userprofile%\Documents\GitHub\Blocker-App\.git\ by Controlled Folder Access.
```

يظهر الفشل كرسالة مضلّلة: `fatal: Unable to create '.git/index.lock': No such file or directory`.

### الحل الدائم (إجراء يدوي مرة واحدة)
Windows Security → Virus & threat protection → Ransomware protection →
**Allow an app through Controlled folder access** → أضف الاثنين:

- `C:\Program Files\Git\mingw64\bin\git.exe`
- `C:\Program Files\Android\Android Studio\jbr\bin\java.exe`

أو من PowerShell **مرتفع الصلاحيات (Run as Administrator)**:

```powershell
Add-MpPreference -ControlledFolderAccessAllowedApplications "C:\Program Files\Git\mingw64\bin\git.exe"
Add-MpPreference -ControlledFolderAccessAllowedApplications "C:\Program Files\Android\Android Studio\jbr\bin\java.exe"
```

> ملاحظات: قد يلزم تكرار إضافة java.exe بعد تحديث Android Studio (يتغير مسار JBR).
> إن كنت تستخدم عميل git آخر (VS Code يستدعي نفس git.exe عادةً) فنفس الاستثناء يكفي.

### تشغيل اختبارات Kotlin محلياً
لا يوجد `JAVA_HOME` مضبوط على الجهاز؛ استخدم JBR الخاص بـ Android Studio:

```bash
cd android
JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew :blocker:testDebugUnitTest
```

### البدائل عندما يكون Gradle محجوباً
1. **CI هو المرجع**: كل push يشغّل `typecheck` + `jest` + `test:blocklists` +
   `:blocker:testDebugUnitTest` + بناء APK (انظر `.github/workflows/ci.yml`).
2. **Node ports**: الخوارزميات النقية في Kotlin (تصنيف النطاقات، فهرس الهاش،
   parsing) تُتحقق محلياً بمنافذ مكافئة بـ Node قبل الدفع — نمط مستخدم في
   جلسات سابقة عند تعديل `DomainClassifier`/`DomainHashIndex`.

## أوامر التحقق السريعة

```bash
# فحص الأنواع (يعمل محلياً دائماً)
node node_modules/typescript/bin/tsc --noEmit

# اختبارات JS
node node_modules/jest/bin/jest.js

# اختبارات القوائم
npm run test:blocklists
```

> `npx` غير متاح في PATH على هذا الجهاز؛ استخدم `node node_modules/...` مباشرة.

## Lint — حالة مؤجَّلة
لا يوجد eslint ولا ktlint في المشروع حالياً. إضافتهما تتطلب جولة إصلاح مخالفات
كاملة (وktlint يحتاج توليد baseline عبر Gradle المحجوب محلياً) — بند مستقل في
خطة التحسين (`docs/improvement-plan-2026-07.md`، البند P6.3).
