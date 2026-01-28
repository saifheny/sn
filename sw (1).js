// sw.js - Service Worker للعمل بدون إنترنت

const CACHE_NAME = 'local-ai-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/db.js',
    '/fetcher.js',
    '/processor.js',
    '/ai-engine.js'
];

// التثبيت
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Service Worker: Cache failed', error);
            })
    );
    
    // تفعيل فوري
    self.skipWaiting();
});

// التفعيل
self.addEventListener('activate', event => {
    console.log('Service Worker: Activated');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    
    return self.clients.claim();
});

// التعامل مع الطلبات
self.addEventListener('fetch', event => {
    // تجاهل الطلبات من خارج النطاق
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // إرجاع من الكاش إذا وُجد
                if (response) {
                    return response;
                }

                // محاولة جلب من الشبكة
                return fetch(event.request)
                    .then(response => {
                        // التحقق من صحة الاستجابة
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // نسخ الاستجابة للكاش
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // في حالة الفشل، محاولة إرجاع صفحة أوفلاين
                        return caches.match('/index.html');
                    });
            })
    );
});

// التعامل مع الرسائل
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
