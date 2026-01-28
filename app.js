import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';

// إعدادات البيئة: منع تحميل النماذج البعيدة إذا كانت مخزنة بالفعل
env.allowLocalModels = false;
env.useBrowserCache = true;

// حالة التطبيق
let summarizer = null;
const dbName = 'LocalAI_DB';
const storeName = 'knowledge_store';
const statusEl = document.getElementById('status');
const btn = document.getElementById('searchBtn');
const resultsArea = document.getElementById('resultsArea');
const loader = document.getElementById('loader');

// 1️⃣ تهيئة الذكاء الاصطناعي (Task 4)
async function initAI() {
    try {
        // نستخدم نموذج خفيف جدًا للتلخيص لضمان العمل في المتصفح
        summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
        statusEl.textContent = '✅ النظام جاهز. (يعمل محليًا بالكامل)';
        statusEl.style.color = 'green';
        btn.disabled = false;
    } catch (err) {
        statusEl.textContent = '❌ خطأ في تحميل الـ AI. تأكد من دعم WebGL.';
        console.error(err);
    }
}

// 2️⃣ إعداد قاعدة البيانات IndexedDB (Task 6)
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function storeData(data) {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(data);
    return tx.complete;
}

async function searchLocalDB(keyword) {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => {
            const results = request.result;
            // بحث بسيط (Local RAG)
            const found = results.find(item => item.id.toLowerCase() === keyword.toLowerCase());
            resolve(found || null);
        };
    });
}

// 3️⃣ جلب البيانات من ويكيبيديا (Task 2)
async function fetchWikipedia(query) {
    // نستخدم الـ API الإنجليزية لأن النموذج المستخدم في التلخيص إنجليزي لضمان الدقة في هذا الـ Demo
    const endpoint = `https://en.wikipedia.org/w/api.php?origin=*&action=query&prop=extracts&exintro&explaintext&format=json&titles=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        
        if (pageId === "-1") return null;
        
        return {
            title: pages[pageId].title,
            content: pages[pageId].extract,
            url: `https://en.wikipedia.org/?curid=${pageId}`
        };
    } catch (error) {
        console.error("Network Error:", error);
        return null;
    }
}

// 4️⃣ المنطق الرئيسي (Task 3, 5, 7)
btn.addEventListener('click', async () => {
    const query = document.getElementById('queryInput').value.trim();
    if (!query) return;

    resultsArea.innerHTML = '';
    loader.style.display = 'block';
    btn.disabled = true;

    // A. البحث المحلي أولاً (Offline First / Local RAG)
    const localResult = await searchLocalDB(query);
    
    if (localResult) {
        displayResult(localResult, '📂 من الذاكرة المحلية (Offline)');
        loader.style.display = 'none';
        btn.disabled = false;
        return;
    }

    // B. إذا لم يوجد محليًا، نجلب من الإنترنت (Online Fetch)
    if (!navigator.onLine) {
        loader.style.display = 'none';
        btn.disabled = false;
        alert("لا يوجد اتصال بالإنترنت ولا توجد بيانات مخزنة لهذا البحث.");
        return;
    }

    const rawData = await fetchWikipedia(query);

    if (rawData) {
        // تلخيص المحتوى باستخدام الـ AI المحلي
        const summaryOutput = await summarizer(rawData.content, {
            max_new_tokens: 100,
            min_new_tokens: 30,
        });
        
        const aiSummary = summaryOutput[0].summary_text;

        // تجهيز الكائن للتخزين
        const knowledgeItem = {
            id: query, // استخدام الاستعلام كمفتاح
            title: rawData.title,
            originalText: rawData.content,
            summary: aiSummary,
            source: 'Wikipedia API',
            url: rawData.url,
            timestamp: new Date().toISOString()
        };

        // التخزين المحلي
        await storeData(knowledgeItem);
        
        displayResult(knowledgeItem, '☁️ تم الجلب والتحليل (Live AI)');
    } else {
        resultsArea.innerHTML = '<p style="color:red; text-align:center">لم يتم العثور على معلومات دقيقة.</p>';
    }

    loader.style.display = 'none';
    btn.disabled = false;
});

function displayResult(item, sourceTag) {
    const html = `
        <div class="result-card">
            <span class="tag">${sourceTag}</span>
            <h3>${item.title}</h3>
            <p><strong>🤖 ملخص الـ AI:</strong> ${item.summary}</p>
            <details>
                <summary>النص الأصلي</summary>
                <p style="font-size:0.85rem; color:#555">${item.originalText.substring(0, 300)}...</p>
            </details>
            <br>
            <a href="${item.url}" target="_blank" class="source-link">🔗 المصدر الأصلي</a>
            <div style="font-size:0.7rem; color:#999; margin-top:5px">تاريخ التحديث: ${new Date(item.timestamp).toLocaleString()}</div>
        </div>
    `;
    resultsArea.innerHTML = html;
}

// بدء التشغيل
initAI();
