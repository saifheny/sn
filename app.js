// app.js - التطبيق الرئيسي

class LocalAIApp {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isProcessing = false;
        
        // عناصر DOM
        this.elements = {
            queryInput: document.getElementById('queryInput'),
            searchBtn: document.getElementById('searchBtn'),
            onlineSearch: document.getElementById('onlineSearch'),
            useSummarization: document.getElementById('useSummarization'),
            onlineStatus: document.getElementById('onlineStatus'),
            aiStatus: document.getElementById('aiStatus'),
            storageStatus: document.getElementById('storageStatus'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            loadingText: document.getElementById('loadingText'),
            resultsSection: document.getElementById('resultsSection'),
            answerBox: document.getElementById('answerBox'),
            aiAnswer: document.getElementById('aiAnswer'),
            sourcesBox: document.getElementById('sourcesBox'),
            sourcesList: document.getElementById('sourcesList'),
            cachedBox: document.getElementById('cachedBox'),
            cachedResults: document.getElementById('cachedResults'),
            clearCacheBtn: document.getElementById('clearCacheBtn'),
            exportDataBtn: document.getElementById('exportDataBtn'),
            viewStatsBtn: document.getElementById('viewStatsBtn')
        };

        this.init();
    }

    async init() {
        try {
            // تهيئة قاعدة البيانات
            await localDB.init();
            console.log('Database initialized');

            // تهيئة محرك الذكاء الاصطناعي
            await aiEngine.init();
            this.updateAIStatus(true);
            console.log('AI Engine initialized');

            // تحديث عداد التخزين
            await this.updateStorageCount();

            // تسجيل أحداث
            this.registerEvents();

            // مراقبة حالة الاتصال
            this.monitorConnection();

            // تسجيل Service Worker
            this.registerServiceWorker();

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('حدث خطأ في تهيئة التطبيق');
        }
    }

    registerEvents() {
        // زر البحث
        this.elements.searchBtn.addEventListener('click', () => this.handleSearch());

        // Enter في حقل الإدخال
        this.elements.queryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isProcessing) {
                this.handleSearch();
            }
        });

        // زر مسح الذاكرة
        this.elements.clearCacheBtn.addEventListener('click', () => this.clearCache());

        // زر تصدير البيانات
        this.elements.exportDataBtn.addEventListener('click', () => this.exportData());

        // زر عرض الإحصائيات
        this.elements.viewStatsBtn.addEventListener('click', () => this.viewStats());
    }

    async handleSearch() {
        const query = this.elements.queryInput.value.trim();
        
        if (!query) {
            this.showError('الرجاء إدخال سؤال');
            return;
        }

        if (this.isProcessing) return;

        this.isProcessing = true;
        this.showLoading('جاري البحث...');
        this.elements.searchBtn.disabled = true;

        try {
            let results = [];
            let cachedResults = [];

            // البحث في الذاكرة المحلية أولاً
            cachedResults = await localDB.searchKnowledge(query);
            
            // إذا كان متصلاً والبحث الأونلاين مفعل
            if (this.isOnline && this.elements.onlineSearch.checked) {
                this.updateLoadingText('جاري جلب المعلومات من الإنترنت...');
                results = await dataFetcher.fetchAll(query);
                
                if (results.length > 0) {
                    this.updateLoadingText('جاري معالجة البيانات...');
                    results = dataProcessor.processResults(results);

                    // حفظ في قاعدة البيانات
                    for (const result of results) {
                        await localDB.saveKnowledge({
                            query: query,
                            originalText: result.content,
                            summary: result.content.substring(0, 500),
                            source: result.source,
                            url: result.url,
                            quality: result.quality
                        });
                    }

                    await this.updateStorageCount();
                }
            }

            // إذا لم تكن هناك نتائج من الإنترنت، استخدم النتائج المحلية
            if (results.length === 0 && cachedResults.length > 0) {
                this.showInfo('لا توجد نتائج جديدة، يتم عرض المعلومات المحفوظة');
            } else if (results.length === 0 && cachedResults.length === 0) {
                this.showError('لم يتم العثور على نتائج. حاول سؤالاً آخر.');
                return;
            }

            // توليد الإجابة الذكية
            let aiAnswer = '';
            if (this.elements.useSummarization.checked && aiEngine.isEngineReady()) {
                this.updateLoadingText('جاري توليد الإجابة الذكية...');
                
                const allContent = [
                    ...results.map(r => r.content),
                    ...cachedResults.map(r => r.summary)
                ].join('\n\n');

                if (allContent) {
                    aiAnswer = await aiEngine.generateAnswer(query, allContent);
                }
            }

            // عرض النتائج
            this.displayResults(results, cachedResults, aiAnswer);

            // حفظ في التاريخ
            await localDB.saveHistory(query, [...results, ...cachedResults]);

        } catch (error) {
            console.error('Search error:', error);
            this.showError('حدث خطأ أثناء البحث: ' + error.message);
        } finally {
            this.isProcessing = false;
            this.hideLoading();
            this.elements.searchBtn.disabled = false;
        }
    }

    displayResults(onlineResults, cachedResults, aiAnswer) {
        // إظهار قسم النتائج
        this.elements.resultsSection.classList.remove('hidden');

        // عرض الإجابة الذكية
        if (aiAnswer) {
            this.elements.answerBox.classList.remove('hidden');
            this.elements.aiAnswer.innerHTML = this.formatMarkdown(aiAnswer);
        } else {
            this.elements.answerBox.classList.add('hidden');
        }

        // عرض النتائج من الإنترنت
        if (onlineResults.length > 0) {
            this.elements.sourcesBox.classList.remove('hidden');
            this.elements.sourcesList.innerHTML = onlineResults.map(result => `
                <div class="source-item">
                    <h4>${this.escapeHtml(result.title)}</h4>
                    <p>${this.escapeHtml(result.content.substring(0, 300))}...</p>
                    <a href="${result.url}" target="_blank" class="source-link">
                        ${result.source} - اقرأ المزيد →
                    </a>
                </div>
            `).join('');
        } else {
            this.elements.sourcesBox.classList.add('hidden');
        }

        // عرض النتائج المحلية
        if (cachedResults.length > 0) {
            this.elements.cachedBox.classList.remove('hidden');
            this.elements.cachedResults.innerHTML = cachedResults.map(result => `
                <div class="cached-item">
                    <h4>${this.escapeHtml(result.query)}</h4>
                    <p>${this.escapeHtml(result.summary)}</p>
                    <small style="color: #6b7280;">
                        ${result.source} - ${new Date(result.timestamp).toLocaleDateString('ar')}
                    </small>
                </div>
            `).join('');
        } else {
            this.elements.cachedBox.classList.add('hidden');
        }

        // التمرير إلى النتائج
        this.elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^(.+)$/, '<p>$1</p>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async clearCache() {
        if (confirm('هل تريد حذف جميع البيانات المحفوظة؟')) {
            try {
                await localDB.clearAll();
                await this.updateStorageCount();
                this.showInfo('تم مسح الذاكرة بنجاح');
                this.elements.resultsSection.classList.add('hidden');
            } catch (error) {
                this.showError('حدث خطأ أثناء المسح');
            }
        }
    }

    async exportData() {
        try {
            const data = await localDB.exportData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `local-ai-backup-${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.showInfo('تم تصدير البيانات بنجاح');
        } catch (error) {
            this.showError('حدث خطأ أثناء التصدير');
        }
    }

    async viewStats() {
        try {
            const stats = await localDB.getStats();
            const message = `
📊 إحصائيات التطبيق:

💾 المعرفة المحفوظة: ${stats.totalKnowledge}
📝 سجل البحث: ${stats.totalHistory}
🌐 عدد المصادر: ${stats.sources}
📅 أقدم إدخال: ${stats.oldestEntry ? stats.oldestEntry.toLocaleDateString('ar') : 'لا يوجد'}
🆕 أحدث إدخال: ${stats.newestEntry ? stats.newestEntry.toLocaleDateString('ar') : 'لا يوجد'}
            `;
            alert(message);
        } catch (error) {
            this.showError('حدث خطأ أثناء عرض الإحصائيات');
        }
    }

    async updateStorageCount() {
        const count = await localDB.getStorageCount();
        this.elements.storageStatus.textContent = `💾 ${count} عنصر محفوظ`;
    }

    monitorConnection() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateOnlineStatus(true);
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateOnlineStatus(false);
        });

        this.updateOnlineStatus(this.isOnline);
    }

    updateOnlineStatus(isOnline) {
        if (isOnline) {
            this.elements.onlineStatus.textContent = '🟢 متصل';
            this.elements.onlineStatus.classList.add('online');
            this.elements.onlineStatus.classList.remove('offline');
        } else {
            this.elements.onlineStatus.textContent = '🔴 غير متصل';
            this.elements.onlineStatus.classList.add('offline');
            this.elements.onlineStatus.classList.remove('online');
        }
    }

    updateAIStatus(isReady) {
        if (isReady) {
            this.elements.aiStatus.textContent = '🤖 الذكاء الاصطناعي جاهز';
        } else {
            this.elements.aiStatus.textContent = '⚠️ الذكاء الاصطناعي غير جاهز';
        }
    }

    showLoading(text) {
        this.elements.loadingText.textContent = text;
        this.elements.loadingIndicator.classList.remove('hidden');
    }

    hideLoading() {
        this.elements.loadingIndicator.classList.add('hidden');
    }

    updateLoadingText(text) {
        this.elements.loadingText.textContent = text;
    }

    showError(message) {
        alert('❌ ' + message);
    }

    showInfo(message) {
        alert('ℹ️ ' + message);
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered');
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }
    }
}

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LocalAIApp();
});
