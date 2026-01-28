const CACHE_NAME = 'ai-assistant-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/app.js'
    // يتم تخزين ملفات النموذج تلقائيًا بواسطة transformers.js في cache منفصل،
    // لكننا نضمن هنا عمل الواجهة الأساسية
];

// 1. التثبيت (Install)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// 2. التفعيل (Activate) - تنظيف الكاش القديم
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
});

// 3. الاعتراض (Fetch)
self.addEventListener('fetch', (event) => {
    // استثناء طلبات الـ API والـ Models لتتم معالجتها ديناميكيًا أو عبر كاش المكتبة
    if (event.request.url.includes('wikipedia') || event.request.url.includes('huggingface')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
