// processor.js - معالجة وتنظيف البيانات

class DataProcessor {
    constructor() {
        this.minContentLength = 50;
        this.maxContentLength = 5000;
    }

    // تنظيف النص
    cleanText(text) {
        if (!text) return '';

        return text
            // إزالة الأسطر الفارغة المتعددة
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            // إزالة المسافات الزائدة
            .replace(/\s+/g, ' ')
            // إزالة الرموز الغريبة
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            // تنظيف علامات الترقيم المكررة
            .replace(/([.!?])\1+/g, '$1')
            // تنظيف الأقواس الفارغة
            .replace(/\(\s*\)/g, '')
            .replace(/\[\s*\]/g, '')
            // تنظيف الأطراف
            .trim();
    }

    // إزالة المحتوى غير المفيد
    filterUsefulContent(text) {
        // قائمة بالعبارات غير المفيدة
        const noisePatterns = [
            /^(advertisement|sponsored|click here|subscribe|follow us)/i,
            /\b(cookies?|privacy policy|terms of service)\b/i,
            /^\d{1,2}\/\d{1,2}\/\d{2,4}$/m, // تواريخ منفردة
        ];

        let cleaned = text;
        noisePatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });

        return cleaned;
    }

    // استخراج المعلومات الأساسية
    extractKeyInfo(text, maxSentences = 10) {
        if (!text) return '';

        // تقسيم إلى جمل
        const sentences = text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 20); // جمل ذات معنى فقط

        // اختيار أول N جملة (غالباً تحتوي المقدمة على المعلومات المهمة)
        return sentences
            .slice(0, maxSentences)
            .join('. ') + (sentences.length > maxSentences ? '...' : '.');
    }

    // تصنيف جودة المصدر
    assessQuality(source) {
        const highQualitySources = [
            'wikipedia',
            'dbpedia',
            '.edu',
            '.gov',
            'scholar.google'
        ];

        const mediumQualitySources = [
            '.org',
            'news',
            'bbc',
            'reuters'
        ];

        const sourceLower = source.toLowerCase();

        if (highQualitySources.some(q => sourceLower.includes(q))) {
            return 'high';
        } else if (mediumQualitySources.some(q => sourceLower.includes(q))) {
            return 'medium';
        }

        return 'low';
    }

    // معالجة نتيجة واحدة
    processResult(result) {
        const processed = {
            ...result,
            content: this.cleanText(result.content),
            quality: result.quality || this.assessQuality(result.source)
        };

        // تصفية المحتوى
        processed.content = this.filterUsefulContent(processed.content);

        // التحقق من الطول المناسب
        if (processed.content.length < this.minContentLength) {
            processed.valid = false;
            processed.reason = 'content_too_short';
        } else if (processed.content.length > this.maxContentLength) {
            // اختصار المحتوى الطويل
            processed.content = this.extractKeyInfo(processed.content, 15);
            processed.valid = true;
            processed.truncated = true;
        } else {
            processed.valid = true;
        }

        return processed;
    }

    // معالجة مجموعة نتائج
    processResults(results) {
        return results
            .map(result => this.processResult(result))
            .filter(result => result.valid)
            .sort((a, b) => {
                // ترتيب حسب الجودة
                const qualityOrder = { high: 3, medium: 2, low: 1 };
                return qualityOrder[b.quality] - qualityOrder[a.quality];
            });
    }

    // استخراج الكلمات المفتاحية
    extractKeywords(text, count = 10) {
        if (!text) return [];

        // كلمات توقف عربية شائعة
        const stopWords = new Set([
            'في', 'من', 'إلى', 'على', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي',
            'أن', 'إن', 'لا', 'ما', 'قد', 'كان', 'لم', 'لن', 'كل', 'بعض',
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was',
            'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did'
        ]);

        const words = text
            .toLowerCase()
            .split(/\s+/)
            .filter(word => 
                word.length > 3 && 
                !stopWords.has(word) &&
                /^[\u0600-\u06FFa-z]+$/.test(word) // عربي أو إنجليزي فقط
            );

        // حساب التكرار
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });

        // ترتيب حسب التكرار
        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, count)
            .map(([word]) => word);
    }

    // دمج معلومات من مصادر متعددة
    mergeInformation(results) {
        if (results.length === 0) return null;
        if (results.length === 1) return results[0].content;

        // استخراج الجمل الفريدة
        const allSentences = new Set();
        
        results.forEach(result => {
            const sentences = result.content
                .split(/[.!?]+/)
                .map(s => s.trim())
                .filter(s => s.length > 20);
            
            sentences.forEach(s => allSentences.add(s));
        });

        // إنشاء ملخص موحد
        const merged = Array.from(allSentences)
            .slice(0, 15) // أول 15 جملة فريدة
            .join('. ') + '.';

        return merged;
    }

    // تحليل الموضوع
    analyzeContent(text) {
        const keywords = this.extractKeywords(text);
        const wordCount = text.split(/\s+/).length;
        const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

        return {
            keywords,
            wordCount,
            sentenceCount,
            avgWordsPerSentence: Math.round(wordCount / sentenceCount),
            estimatedReadingTime: Math.ceil(wordCount / 200) // دقائق
        };
    }
}

const dataProcessor = new DataProcessor();
