export const trWords = [
    "bir", "ve", "için", "bu", "o", "ile", "de", "çok", "da", "daha",
    "gibi", "ama", "var", "kadar", "ben", "sonra", "en", "ne", "yok", "olan",
    "her", "iki", "sen", "kendi", "on", "değil", "zaman", "diye", "biz", "nasıl",
    "böyle", "başka", "iyi", "beni", "onu", "şey", "ya", "şu", "bana", "ancak",
    "hiç", "oldu", "seni", "veya", "ki", "ona", "bize", "olur", "tüm", "önce",
    "biraz", "doğru", "aynı", "kim", "bile", "tek", "işte", "artık", "benim", "falan",
    "göre", "siz", "neden", "belki", "evet", "hayır", "yeni", "gün", "biri", "bazı",
    "yer", "tam", "pek", "yine", "ilk", "son", "burada", "sadece", "orada", "hep",
    "büyük", "küçük", "kötü", "güzel", "az", "olsun", "eder", "etmiş", "olacak", "yüz",
    "el", "göz", "yol", "çocuk", "adam", "kadın", "iş", "yıl", "su", "ev"
];

export const enWords = [
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", 
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at", 
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", 
    "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", 
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me", 
    "when", "make", "can", "like", "time", "no", "just", "him", "know", "take", 
    "people", "into", "year", "your", "good", "some", "could", "them", "see", "other", 
    "than", "then", "now", "look", "only", "come", "its", "over", "think", "also", 
    "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", 
    "even", "new", "want", "because", "any", "these", "give", "day", "most", "us"
];

export const frWords = [
    "le", "de", "un", "à", "être", "et", "en", "avoir", "que", "pour",
    "dans", "ce", "il", "qui", "ne", "sur", "se", "pas", "plus", "pouvoir",
    "par", "je", "avec", "tout", "faire", "son", "mettre", "autre", "on", "mais",
    "nous", "comme", "ou", "si", "leur", "y", "dire", "elle", "devoir", "avant",
    "deux", "même", "prendre", "où", "aussi", "celui", "bien", "cela", "une", "votre"
];

export const esWords = [
    "el", "de", "que", "y", "a", "en", "un", "ser", "se", "no",
    "haber", "por", "con", "su", "para", "como", "estar", "tener", "le", "lo",
    "todo", "pero", "más", "hacer", "o", "poder", "decir", "este", "ir", "otro",
    "ese", "la", "si", "me", "ya", "ver", "porque", "dar", "cuando", "él",
    "muy", "sin", "vez", "mucho", "saber", "qué", "sobre", "mi", "alguno", "hasta"
];

export const deWords = [
    "der", "die", "und", "in", "den", "von", "zu", "das", "mit", "sich",
    "des", "auf", "für", "ist", "im", "dem", "nicht", "ein", "eine", "als",
    "auch", "es", "an", "werden", "aus", "er", "hat", "dass", "sie", "nach",
    "wird", "bei", "einer", "um", "am", "sind", "noch", "wie", "einem", "über",
    "einen", "so", "zum", "war", "haben", "nur", "oder", "aber", "vor", "zur"
];

export const itWords = [
    "il", "di", "e", "a", "un", "in", "che", "non", "si", "da",
    "lo", "per", "con", "ma", "come", "su", "mi", "anche", "o", "io",
    "se", "perché", "lei", "questo", "chi", "ci", "ti", "lui", "cosa", "quando",
    "due", "molto", "c'è", "tutto", "fare", "essere", "avere", "dire", "potere", "volere",
    "sapere", "stare", "dovere", "vedere", "andare", "venire", "dare", "parlare", "trovare", "ogni"
];

const languages = {
    "tr": trWords,
    "en": enWords,
    "fr": frWords,
    "es": esWords,
    "de": deWords,
    "it": itWords
};

export function detectLanguage(wordsArray) {
    if (!wordsArray || wordsArray.length === 0) return trWords;

    // Use a sample of 500 words to speed up processing
    const sample = wordsArray.slice(0, 500).map(k => k.replace(/[.,!?;:]+$/, '').toLowerCase());
    
    const scores = {
        "tr": 0, "en": 0, "fr": 0, "es": 0, "de": 0, "it": 0
    };

    for (const word of sample) {
        if (trWords.includes(word)) scores["tr"]++;
        if (enWords.includes(word)) scores["en"]++;
        if (frWords.includes(word)) scores["fr"]++;
        if (esWords.includes(word)) scores["es"]++;
        if (deWords.includes(word)) scores["de"]++;
        if (itWords.includes(word)) scores["it"]++;
    }

    let detectedLang = "tr";
    let maxScore = scores["tr"];

    for (const lang in scores) {
        if (scores[lang] > maxScore) {
            maxScore = scores[lang];
            detectedLang = lang;
        }
    }

    console.log(`Language detection scores:`, scores);
    console.log(`Detected Language: ${detectedLang.toUpperCase()}`);
    
    return languages[detectedLang];
}
