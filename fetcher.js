// fetcher.js - جلب البيانات من مصادر مفتوحة

class DataFetcher {
    constructor() {
        this.timeout = 10000; // 10 ثواني
    }

    // جلب من Wikipedia
    async fetchFromWikipedia(query) {
        try {
            const searchUrl = `https://ar.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json&origin=*`;
            
            const response = await this.fetchWithTimeout(searchUrl);
            const data = await response.json();

            if (!data[1] || data[1].length === 0) {
                // محاولة البحث بالإنجليزية
                const enSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json&origin=*`;
                const enResponse = await this.fetchWithTimeout(enSearchUrl);
                const enData = await enResponse.json();
                
                if (!enData[1] || enData[1].length === 0) {
                    return [];
                }
                
                return await this.getWikipediaDetails(enData[1], 'en');
            }

            return await this.getWikipediaDetails(data[1], 'ar');
        } catch (error) {
            console.error('Wikipedia fetch error:', error);
            return [];
        }
    }

    async getWikipediaDetails(titles, lang = 'ar') {
        const results = [];
        
        for (const title of titles.slice(0, 2)) {
            try {
                const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*`;
                
                const response = await this.fetchWithTimeout(apiUrl);
                const data = await response.json();

                const pages = data.query.pages;
                const pageId = Object.keys(pages)[0];
                const page = pages[pageId];

                if (page.extract) {
                    results.push({
                        title: page.title,
                        content: page.extract,
                        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
                        source: 'Wikipedia',
                        quality: 'high',
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.error(`Error fetching ${title}:`, error);
            }
        }

        return results;
    }

    // جلب من مصادر RSS
    async fetchFromRSS(query) {
        // لأن RSS يحتاج parser خاص وقد لا يعمل مع CORS
        // نستخدم بدلاً منه APIs عامة
        return [];
    }

    // البحث في مصادر عامة أخرى
    async fetchFromPublicAPIs(query) {
        const results = [];

        try {
            // DBpedia - قاعدة بيانات ويكيبيديا المنظمة
            const dbpediaUrl = `https://lookup.dbpedia.org/api/search?query=${encodeURIComponent(query)}&format=json&maxResults=3`;
            
            const response = await this.fetchWithTimeout(dbpediaUrl);
            const data = await response.json();

            if (data.docs) {
                data.docs.forEach(doc => {
                    if (doc.comment && doc.comment.length > 50) {
                        results.push({
                            title: doc.label[0],
                            content: doc.comment[0],
                            url: doc.resource[0],
                            source: 'DBpedia',
                            quality: 'high',
                            timestamp: Date.now()
                        });
                    }
                });
            }
        } catch (error) {
            console.error('DBpedia fetch error:', error);
        }

        return results;
    }

    // دالة fetch مع timeout
    fetchWithTimeout(url, options = {}) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), this.timeout)
            )
        ]);
    }

    // جلب شامل من جميع المصادر
    async fetchAll(query) {
        const results = {
            wikipedia: [],
            apis: [],
            total: 0,
            errors: []
        };

        try {
            // جلب موازي من المصادر المختلفة
            const [wikiResults, apiResults] = await Promise.allSettled([
                this.fetchFromWikipedia(query),
                this.fetchFromPublicAPIs(query)
            ]);

            if (wikiResults.status === 'fulfilled') {
                results.wikipedia = wikiResults.value;
            } else {
                results.errors.push('Wikipedia: ' + wikiResults.reason);
            }

            if (apiResults.status === 'fulfilled') {
                results.apis = apiResults.value;
            } else {
                results.errors.push('APIs: ' + apiResults.reason);
            }

            // دمج النتائج
            const allResults = [
                ...results.wikipedia,
                ...results.apis
            ];

            // إزالة التكرار
            const uniqueResults = this.removeDuplicates(allResults);
            
            results.total = uniqueResults.length;
            
            return uniqueResults;

        } catch (error) {
            console.error('Fetch all error:', error);
            results.errors.push(error.message);
            return [];
        }
    }

    // إزالة النتائج المكررة
    removeDuplicates(results) {
        const seen = new Set();
        return results.filter(item => {
            const key = item.title.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // فحص الاتصال بالإنترنت
    async checkConnection() {
        try {
            const response = await fetch('https://www.wikipedia.org/favicon.ico', {
                method: 'HEAD',
                mode: 'no-cors'
            });
            return true;
        } catch {
            return false;
        }
    }
}

const dataFetcher = new DataFetcher();
