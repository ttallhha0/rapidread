import { hesaplaKelimeSuresi } from './speed-calc.js';
import { kelimeyiEkranaYaz } from './ui.js';
import { trWords, detectLanguage } from '../data/common-words.js';

export class RsvpReader {
    /**
     * @param {string[]} kelimeler - Okunacak kelimeler dizisi
     * @param {HTMLElement} containerElement - Kelimenin gösterileceği HTML elementi
     * @param {number} hedefWPM - Başlangıç okuma hızı (WPM)
     */
    constructor(kelimeler = [], containerElement = null, hedefWPM = 250) {
        this.kelimeler = kelimeler;
        this.containerElement = containerElement;
        this.hedefWPM = hedefWPM;
        
        this.guncelIndeks = 0;
        this.okuyorMu = false;
        this.smartSpeedEnabled = true;
        this.onIndexChange = null;
        
        // Varsayılan olarak Türkçe sözlükle başlar, metin yüklenince otomatik güncellenir
        this.aktifSozluk = trWords;
    }

    /**
     * async/await ile senkron akış içerisinde bekleme yapmayı sağlayan yardımcı metod
     * @param {number} ms - Milisaniye cinsinden bekleme süresi
     */
    bekle(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Okumayı başlatır veya kaldığı yerden devam ettirir.
     */
    async play() {
        // Eğer okuma halihazırda devam ediyorsa tekrar çalışmasını engelle
        if (this.okuyorMu) return;
        
        this.okuyorMu = true;

        // Duraklatılmadığı (okuyorMu == true) ve kelimeler bitmediği sürece döngüye devam et
        while (this.okuyorMu && this.guncelIndeks < this.kelimeler.length) {
            const mevcutKelime = this.kelimeler[this.guncelIndeks];

            // 1. Arayüz modülü ile kelimeyi ekranda göster
            if (this.containerElement) {
                kelimeyiEkranaYaz(mevcutKelime, this.containerElement);
            }
            if (this.onIndexChange) this.onIndexChange(this.guncelIndeks);

            // 2. Algoritma modülü ile bu kelimenin ekranda kalma süresini hesapla
            // (Aktif olan dilin yaygın kelimeler sözlüğü kullanılıyor)
            const sure = hesaplaKelimeSuresi(mevcutKelime, this.hedefWPM, this.aktifSozluk, this.smartSpeedEnabled);

            // 3. Hesaplanan süre kadar bekle
            await this.bekle(sure);

            // 4. Sonraki kelimeye geç
            this.guncelIndeks++;
        }

        // Eğer tüm kelimeler okunduysa durumu false yap
        if (this.guncelIndeks >= this.kelimeler.length) {
            this.okuyorMu = false;
        }
    }

    /**
     * Okumayı duraklatır. (Döngü bir sonraki adımda kırılacaktır)
     */
    pause() {
        this.okuyorMu = false;
    }

    /**
     * Okumayı tamamen durdurur, başa sarar ve ekranı temizler.
     */
    reset() {
        this.okuyorMu = false;
        this.guncelIndeks = 0;
        this.kelimeler = [];
        
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
        if (this.onIndexChange) this.onIndexChange(0);
    }

    /**
     * Dışarıdan yeni bir metin/kelime listesi yüklemek için
     */
    metinYukle(yeniKelimeler) {
        this.reset();
        this.kelimeler = yeniKelimeler;
        
        // Metin yüklendiği anda dilini analiz et ve uygun sözlüğü seç
        this.aktifSozluk = detectLanguage(yeniKelimeler);
    }

    /**
     * Dışarıdan okuma hızını değiştirmek için
     */
    hizGuncelle(yeniWPM) {
        this.hedefWPM = yeniWPM;
    }

    /**
     * Akıllı hızlanma modunu açar/kapatır
     */
    setSmartSpeed(isEnabled) {
        this.smartSpeedEnabled = isEnabled;
    }

    /**
     * İstenilen kelime indeksine anında atlar
     */
    setIndex(index) {
        const parsedIndex = parseInt(index, 10);
        if (!isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < this.kelimeler.length) {
            this.guncelIndeks = parsedIndex;
            if (this.containerElement) {
                kelimeyiEkranaYaz(this.kelimeler[this.guncelIndeks], this.containerElement);
            }
            if (this.onIndexChange) this.onIndexChange(this.guncelIndeks);
        }
    }

    /**
     * Searches for a specific word or phrase in the loaded text.
     * Starts searching forward from the current reading index.
     * @param {string} query - The word/phrase to search
     * @returns {number} - Index of the found word, or -1 if not found
     */
    searchPhrase(query) {
        if (!query || !this.kelimeler || this.kelimeler.length === 0) return -1;
        
        const queryWords = query.toLowerCase().trim().split(/\s+/);
        if (queryWords.length === 0) return -1;

        // Start from current index + 1
        let start = this.guncelIndeks + 1;
        if (start >= this.kelimeler.length) start = 0;

        const findMatch = (fromIndex, toIndex) => {
            for (let i = fromIndex; i <= toIndex - queryWords.length; i++) {
                let match = true;
                for (let j = 0; j < queryWords.length; j++) {
                    const textWord = this.kelimeler[i + j].replace(/[.,!?;:()""'']+/g, '').toLowerCase();
                    const qWord = queryWords[j].replace(/[.,!?;:()""'']+/g, '').toLowerCase();
                    
                    if (textWord !== qWord) {
                        match = false;
                        break;
                    }
                }
                if (match) return i;
            }
            return -1;
        };

        // First pass: search from current position to end
        let foundIndex = findMatch(start, this.kelimeler.length);
        
        // Second pass: if not found, wrap around and search from beginning
        if (foundIndex === -1) {
            foundIndex = findMatch(0, start);
        }

        return foundIndex;
    }
}
