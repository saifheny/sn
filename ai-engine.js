// ai-engine.js - محرك الذكاء الاصطناعي المحلي

class AIEngine {
    constructor() {
        this.isReady = false;
        this.model = null;
        this.useSimpleSummarization = true; // نستخدم التلخيص البسيط لأن WebLLM ثقيل
    }

    // تهيئة النموذج
    async init() {
        try {
            console.log('AI Engine: Using rule-based summarization');
            this.isReady = true;
            return true;
        } catch (error) {
            console.error('AI Engine init error:', error);
            return false;
        }
    }

    // تلخيص النص
    async summarize(text, maxSentences = 5) {
        if (!text) return '';

        try {
            // تلخيص بسيط قائم على القواعد
            return this.extractiveSummary(text, maxSentences);
        } catch (error) {
            console.error('Summarization error:', error);
            return text.substring(0, 500) + '...';
        }
    }

    // تلخيص استخراجي (Extractive Summarization)
    extractiveSummary(text, maxSentences = 5) {
        // تقسيم إلى جمل
        const sentences = text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 20);

        if (sentences.length <= maxSentences) {
            return text;
        }

        // حساب أهمية كل جملة
        const scoredSentences = sentences.map((sentence, index) => {
            let score = 0;

            // الجمل الأولى أكثر أهمية
            if (index < 3) score += 5;

            // الجمل التي تحتوي على أرقام
            if (/\d+/.test(sentence)) score += 2;

            // الجمل الطويلة نسبياً
            const words = sentence.split(/\s+/).length;
            if (words > 10 && words < 30) score += 3;

            // الجمل التي تحتوي على كلمات مفتاحية
            const keywords = [
                'هو', 'هي', 'يعد', 'تعتبر', 'يمثل', 'أهم', 'رئيسي', 'أساسي',
                'is', 'are', 'was', 'main', 'important', 'primary', 'key'
            ];
            keywords.forEach(keyword => {
                if (sentence.toLowerCase().includes(keyword)) score += 1;
            });

            // طول الجملة المناسب
            score += Math.min(words / 5, 3);

            return { sentence, score, index };
        });

        // اختيار أفضل الجمل
        const topSentences = scoredSentences
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSentences)
            .sort((a, b) => a.index - b.index); // إعادة الترتيب الأصلي

        return topSentences.map(s => s.sentence).join('. ') + '.';
    }

    // استخراج النقاط المهمة
    async extractKeyPoints(text) {
        const sentences = text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 20);

        // تحليل بسيط للجمل المهمة
        const keyPoints = [];

        sentences.forEach(sentence => {
            // البحث عن جمل تحتوي على معلومات مهمة
            const importanceIndicators = [
                /^(هو|هي|يعد|تعتبر|يمثل)/,
                /^(it is|this is|represents|means)/i,
                /\d+/,  // أرقام
                /(أهم|رئيسي|أساسي|مهم)/,
                /(important|main|key|primary|significant)/i
            ];

            const isImportant = importanceIndicators.some(pattern => 
                pattern.test(sentence)
            );

            if (isImportant && keyPoints.length < 7) {
                // تنسيق الجملة
                let point = sentence.trim();
                if (!point.endsWith('.')) point += '.';
                keyPoints.push(point);
            }
        });

        return keyPoints.length > 0 ? keyPoints : [this.extractiveSummary(text, 3)];
    }

    // توليد إجابة بناءً على السياق
    async generateAnswer(query, context) {
        try {
            // دمج المعلومات من السياق
            const summary = await this.summarize(context, 7);
            const keyPoints = await this.extractKeyPoints(context);

            // بناء إجابة منظمة
            let answer = `**الملخص:**\n\n${summary}\n\n`;
            
            if (keyPoints.length > 1) {
                answer += `**النقاط الرئيسية:**\n\n`;
                keyPoints.forEach((point, i) => {
                    answer += `${i + 1}. ${point}\n`;
                });
            }

            return answer;
        } catch (error) {
            console.error('Answer generation error:', error);
            return context.substring(0, 800) + '...';
        }
    }

    // تحليل مشاعر النص (بسيط)
    analyzeSentiment(text) {
        const positive = ['جيد', 'ممتاز', 'رائع', 'إيجابي', 'good', 'great', 'excellent', 'positive'];
        const negative = ['سيء', 'سلبي', 'خطأ', 'bad', 'negative', 'wrong', 'poor'];

        let score = 0;
        const lowerText = text.toLowerCase();

        positive.forEach(word => {
            const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
            score += count;
        });

        negative.forEach(word => {
            const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
            score -= count;
        });

        if (score > 2) return 'positive';
        if (score < -2) return 'negative';
        return 'neutral';
    }

    // تصنيف الموضوع
    classifyTopic(text) {
        const topics = {
            'تقنية': ['تقنية', 'برمجة', 'كمبيوتر', 'إنترنت', 'technology', 'computer', 'software', 'internet'],
            'علوم': ['علم', 'بحث', 'دراسة', 'science', 'research', 'study'],
            'صحة': ['صحة', 'طب', 'مرض', 'علاج', 'health', 'medical', 'disease', 'treatment'],
            'تاريخ': ['تاريخ', 'قديم', 'حضارة', 'history', 'ancient', 'civilization'],
            'جغرافيا': ['جغرافيا', 'مكان', 'دولة', 'مدينة', 'geography', 'place', 'country', 'city']
        };

        const lowerText = text.toLowerCase();
        const scores = {};

        Object.keys(topics).forEach(topic => {
            scores[topic] = 0;
            topics[topic].forEach(keyword => {
                const count = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
                scores[topic] += count;
            });
        });

        const maxTopic = Object.keys(scores).reduce((a, b) => 
            scores[a] > scores[b] ? a : b
        );

        return scores[maxTopic] > 0 ? maxTopic : 'عام';
    }

    // فحص جاهزية المحرك
    isEngineReady() {
        return this.isReady;
    }
}

const aiEngine = new AIEngine();
