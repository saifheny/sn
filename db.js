// db.js - إدارة قاعدة البيانات المحلية باستخدام IndexedDB

class LocalDatabase {
    constructor() {
        this.dbName = 'LocalAI_DB';
        this.version = 1;
        this.db = null;
    }

    // تهيئة قاعدة البيانات
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // إنشاء مخزن للمعرفة
                if (!db.objectStoreNames.contains('knowledge')) {
                    const knowledgeStore = db.createObjectStore('knowledge', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    knowledgeStore.createIndex('query', 'query', { unique: false });
                    knowledgeStore.createIndex('timestamp', 'timestamp', { unique: false });
                    knowledgeStore.createIndex('source', 'source', { unique: false });
                }

                // إنشاء مخزن للتاريخ
                if (!db.objectStoreNames.contains('history')) {
                    const historyStore = db.createObjectStore('history', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // حفظ معرفة جديدة
    async saveKnowledge(data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['knowledge'], 'readwrite');
            const store = transaction.objectStore('knowledge');

            const knowledgeItem = {
                query: data.query,
                originalText: data.originalText,
                summary: data.summary,
                source: data.source,
                url: data.url,
                timestamp: Date.now(),
                quality: data.quality || 'medium'
            };

            const request = store.add(knowledgeItem);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // البحث في المعرفة المحفوظة
    async searchKnowledge(query) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['knowledge'], 'readonly');
            const store = transaction.objectStore('knowledge');
            const request = store.getAll();

            request.onsuccess = () => {
                const allData = request.result;
                
                // بحث بسيط باستخدام التطابق النصي
                const results = this.rankResults(query, allData);
                resolve(results.slice(0, 5)); // أفضل 5 نتائج
            };

            request.onerror = () => reject(request.error);
        });
    }

    // ترتيب النتائج حسب الصلة
    rankResults(query, data) {
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

        return data.map(item => {
            let score = 0;
            const itemText = (item.query + ' ' + item.summary + ' ' + item.originalText).toLowerCase();

            // حساب النقاط بناءً على التطابق
            queryWords.forEach(word => {
                const count = (itemText.match(new RegExp(word, 'g')) || []).length;
                score += count;
            });

            // تفضيل النتائج الحديثة
            const daysSinceCreation = (Date.now() - item.timestamp) / (1000 * 60 * 60 * 24);
            score += Math.max(0, 10 - daysSinceCreation);

            // تفضيل المصادر عالية الجودة
            if (item.quality === 'high') score += 5;

            return { ...item, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);
    }

    // حفظ في التاريخ
    async saveHistory(query, results) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readwrite');
            const store = transaction.objectStore('history');

            const historyItem = {
                query: query,
                resultsCount: results.length,
                timestamp: Date.now()
            };

            const request = store.add(historyItem);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // الحصول على عدد العناصر المحفوظة
    async getStorageCount() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['knowledge'], 'readonly');
            const store = transaction.objectStore('knowledge');
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // مسح كل البيانات
    async clearAll() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['knowledge', 'history'], 'readwrite');
            
            const knowledgeStore = transaction.objectStore('knowledge');
            const historyStore = transaction.objectStore('history');

            knowledgeStore.clear();
            historyStore.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // تصدير البيانات
    async exportData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['knowledge', 'history'], 'readonly');
            
            const knowledgeStore = transaction.objectStore('knowledge');
            const historyStore = transaction.objectStore('history');

            const knowledgeRequest = knowledgeStore.getAll();
            const historyRequest = historyStore.getAll();

            let knowledge = [];
            let history = [];

            knowledgeRequest.onsuccess = () => {
                knowledge = knowledgeRequest.result;
            };

            historyRequest.onsuccess = () => {
                history = historyRequest.result;
            };

            transaction.oncomplete = () => {
                resolve({
                    knowledge,
                    history,
                    exportDate: new Date().toISOString()
                });
            };

            transaction.onerror = () => reject(transaction.error);
        });
    }

    // الحصول على إحصائيات
    async getStats() {
        const data = await this.exportData();
        
        return {
            totalKnowledge: data.knowledge.length,
            totalHistory: data.history.length,
            oldestEntry: data.knowledge.length > 0 
                ? new Date(Math.min(...data.knowledge.map(k => k.timestamp)))
                : null,
            newestEntry: data.knowledge.length > 0
                ? new Date(Math.max(...data.knowledge.map(k => k.timestamp)))
                : null,
            sources: [...new Set(data.knowledge.map(k => k.source))].length
        };
    }
}

// إنشاء نسخة واحدة من قاعدة البيانات
const localDB = new LocalDatabase();
