import { dosyaOkuVeKelimelereAyir } from './parser.js';
import { RsvpReader } from './reader.js';

// HTML içeriği tamamen yüklendikten sonra olay dinleyicilerini (Event Listeners) ekleyelim
document.addEventListener('DOMContentLoaded', () => {
    
    // HTML'deki gerekli DOM elementlerini (butonlar, inputlar vb.) seçiyoruz
    // (Bu ID'lerin index.html dosyasında tanımlı olduğunu varsayıyoruz)
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const uploadText = document.getElementById('uploadText');
    const wpmSlider = document.getElementById('wpmSlider');
    const wpmDisplay = document.getElementById('wpmDisplay');
    const readerContainer = document.getElementById('readerContainer');
    
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const playPauseText = document.getElementById('playPauseText');
    const resetBtn = document.getElementById('resetBtn');

    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResult = document.getElementById('searchResult');

    const smartSpeedToggle = document.getElementById('smartSpeedToggle');
    const readerWrapper = document.getElementById('readerWrapper');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fsPlayPauseBtn = document.getElementById('fsPlayPauseBtn');

    // Başlangıçta boş bir kelime listesiyle okuyucumuzu (Reader) oluşturuyoruz.
    // Varsayılan WPM değerini 300 olarak belirliyoruz.
    const okuyucu = new RsvpReader([], readerContainer, 300);

    // ---------------------------------------------------------
    // EVENT LISTENERS
    // ---------------------------------------------------------

    const navControls = document.getElementById('navControls');
    const chapterSelect = document.getElementById('chapterSelect');
    const wordIndexInput = document.getElementById('wordIndexInput');

    // Dosya İşleme (Ortak Fonksiyon)
    const handleFileUpload = async (file) => {
        if (!file) return;

        // Geçerli uzantı kontrolü
        const validExtensions = ['.txt', '.epub'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));
        
        if (!isValid) {
            alert('Lütfen sadece .txt veya .epub uzantılı bir dosya yükleyin.');
            return;
        }

        try {
            // İşlem yükünü Parser modülüne devret (Returns { words, chapters })
            const result = await dosyaOkuVeKelimelereAyir(file);
            
            // Sonucu okuma motoruna yükle
            okuyucu.metinYukle(result.words);

            // Arayüz kontrollerini (Chapters/Words) güncelle
            if (navControls) navControls.style.display = 'flex';
            
            if (chapterSelect) {
                chapterSelect.innerHTML = '';
                result.chapters.forEach((chapter) => {
                    const option = document.createElement('option');
                    option.value = chapter.startIndex;
                    option.textContent = chapter.title;
                    chapterSelect.appendChild(option);
                });
            }
            
            if (wordIndexInput) {
                wordIndexInput.max = result.words.length - 1;
                wordIndexInput.value = 0;
            }

            if (uploadText) {
                // İsim çok uzunsa ortasını kırp (İlk 15 ve son 8 karakteri göster)
                let displayName = file.name;
                if (displayName.length > 25) {
                    const firstPart = displayName.substring(0, 15);
                    const lastPart = displayName.substring(displayName.length - 8);
                    displayName = `${firstPart}...${lastPart}`;
                }
                uploadText.textContent = `📖 ${displayName}`;
            }

            // Kitap yüklendiğinde oynatma butonlarını aktif hale getir
            if (playPauseBtn) playPauseBtn.disabled = false;
            if (fsPlayPauseBtn) fsPlayPauseBtn.disabled = false;
            
            console.log(`${result.words.length} words loaded successfully.`);
        } catch (error) {
            console.error("Error parsing file:", error);
            alert("Error parsing file: " + error.message);
        }
    };

    // 1. "Dosya Yükle" İşlemi (Click & File Dialog)
    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            handleFileUpload(event.target.files[0]);
        });
    }

    // 1.5 Drag & Drop (Sürükle-Bırak) İşlemi
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
                // Input'un value'sunu da güncellemek iyi olabilir
                if (fileInput) {
                    fileInput.files = e.dataTransfer.files;
                }
            }
        });
    }

    // Chapter Select Change (Bölüm Değişimi)
    if (chapterSelect) {
        chapterSelect.addEventListener('change', (event) => {
            const startIndex = parseInt(event.target.value, 10);
            okuyucu.setIndex(startIndex);
            if (wordIndexInput) wordIndexInput.value = startIndex;
        });
    }

    // Word Index Input Change (Kelime/Sayfa Numarası Değişimi)
    if (wordIndexInput) {
        wordIndexInput.addEventListener('change', (event) => {
            let startIndex = parseInt(event.target.value, 10);
            if (startIndex < 0) startIndex = 0;
            okuyucu.setIndex(startIndex);
            
            // Eğer girilen index bir chapter başlangıcına denk geliyorsa dropdown'u da güncellemek güzel olur
            // Şimdilik sadece index'e atlıyoruz.
        });
    }

    // 2. Okuma Hızı (WPM) Değiştirme İşlemi (Slider)
    if (wpmSlider) {
        wpmSlider.addEventListener('input', (event) => {
            const yeniHiz = parseInt(event.target.value, 10);
            if (!isNaN(yeniHiz) && yeniHiz > 0) {
                // Ekranda güncel değeri göster (ör: 350 WPM)
                if (wpmDisplay) wpmDisplay.textContent = `${yeniHiz} WPM`;
                // Okuma hızını algoritmaya ilet
                okuyucu.hizGuncelle(yeniHiz);
            }
        });
    }

    // 3. Search (Arama) İşlemi
    if (searchBtn && searchInput) {
        const doSearch = () => {
            const query = searchInput.value;
            if (!query) return;
            
            const matchIndex = okuyucu.searchPhrase(query);
            if (matchIndex !== -1) {
                okuyucu.setIndex(matchIndex);
                if (wordIndexInput) wordIndexInput.value = matchIndex;
                if (searchResult) searchResult.textContent = `Found at word ${matchIndex}`;
            } else {
                if (searchResult) searchResult.textContent = "Phrase not found.";
            }
            
            // Mesajı 3 saniye sonra temizle
            setTimeout(() => { if (searchResult) searchResult.textContent = ''; }, 3000);
        };

        searchBtn.addEventListener('click', doSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doSearch();
        });
    }

    // 4. Play/Pause Toggle İşlemi
    const togglePlayPause = () => {
        if (okuyucu.okuyorMu) {
            // Çalışıyorsa duraklat
            okuyucu.pause();
            if (playPauseIcon) playPauseIcon.textContent = '▶';
            if (playPauseText) playPauseText.textContent = 'Play';
            if (playPauseBtn) {
                playPauseBtn.classList.remove('btn-pause');
                playPauseBtn.classList.add('btn-play');
            }
            if (fsPlayPauseBtn) fsPlayPauseBtn.textContent = '▶ Play';
        } else {
            // Duraklatıldıysa başlat
            okuyucu.play();
            if (playPauseIcon) playPauseIcon.textContent = '⏸';
            if (playPauseText) playPauseText.textContent = 'Pause';
            if (playPauseBtn) {
                playPauseBtn.classList.remove('btn-play');
                playPauseBtn.classList.add('btn-pause');
            }
            if (fsPlayPauseBtn) fsPlayPauseBtn.textContent = '⏸ Pause';
        }
    };

    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (fsPlayPauseBtn) fsPlayPauseBtn.addEventListener('click', togglePlayPause);

    // Boşluk (Spacebar) tuşu ile başlatma/durdurma
    document.addEventListener('keydown', (e) => {
        // Input alanlarında yazarken boşluk tuşunun play/pause yapmasını engelle
        if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
            e.preventDefault(); // Sayfanın aşağı kaymasını engeller
            togglePlayPause();
        }
    });

    // 5. "Sıfırla" (Reset) İşlemi
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            okuyucu.reset();
            
            // Arayüzü başlangıç haline (kitap yüklenmemiş duruma) döndür
            if (fileInput) fileInput.value = '';
            if (uploadText) uploadText.textContent = '📁 Select Book (.txt, .epub)';
            if (navControls) navControls.style.display = 'none';
            if (readerContainer) {
                readerContainer.innerHTML = '<span class="placeholder-text">Load a text to begin reading...</span>';
            }

            // Buton durumunu sıfırla ve deaktif et
            if (playPauseBtn) {
                if (playPauseIcon) playPauseIcon.textContent = '▶';
                if (playPauseText) playPauseText.textContent = 'Play';
                playPauseBtn.classList.remove('btn-pause');
                playPauseBtn.classList.add('btn-play');
                playPauseBtn.disabled = true;
            }
            if (fsPlayPauseBtn) {
                fsPlayPauseBtn.textContent = '▶ Play';
                fsPlayPauseBtn.disabled = true;
            }
        });
    }

    // 6. Smart Speed Toggle (Akıllı Hızlanma Aç/Kapat)
    if (smartSpeedToggle) {
        smartSpeedToggle.addEventListener('change', (event) => {
            okuyucu.setSmartSpeed(event.target.checked);
        });
    }

    // 7. Fullscreen Toggle (Tam Ekran)
    if (fullscreenBtn && readerWrapper) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                readerWrapper.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });
        
        // Tam ekran durumu değiştiğinde ikon güncelleme (Opsiyonel)
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                fullscreenBtn.textContent = '✕';
                fullscreenBtn.title = 'Exit Fullscreen';
            } else {
                fullscreenBtn.textContent = '⛶';
                fullscreenBtn.title = 'Toggle Fullscreen';
            }
        });
    }
});
