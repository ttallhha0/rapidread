import { dosyaOkuVeKelimelereAyir } from './parser.js?v=20260621-1';
import { RsvpReader } from './reader.js?v=20260621-1';

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
    const chunkSizeSelect = document.getElementById('chunkSizeSelect');
    const readerWrapper = document.getElementById('readerWrapper');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fsPlayPauseBtn = document.getElementById('fsPlayPauseBtn');
    const fsPrevWordBtn = document.getElementById('fsPrevWordBtn');
    const fsNextWordBtn = document.getElementById('fsNextWordBtn');
    const fsWpmDownBtn = document.getElementById('fsWpmDownBtn');
    const fsWpmUpBtn = document.getElementById('fsWpmUpBtn');
    const fsWpmDisplay = document.getElementById('fsWpmDisplay');

    // Başlangıçta boş bir kelime listesiyle okuyucumuzu (Reader) oluşturuyoruz.
    // Varsayılan WPM değerini 300 olarak belirliyoruz.
    const okuyucu = new RsvpReader([], readerContainer, 300);

    const wordCounterValue = document.getElementById('wordCounterValue');
    const copyWordIndexBtn = document.getElementById('copyWordIndexBtn');
    const readingStats = document.getElementById('readingStats');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressWords = document.getElementById('progressWords');
    const remainingTime = document.getElementById('remainingTime');

    const STORAGE_KEYS = {
        settings: 'rapidread:settings',
        progressPrefix: 'rapidread:progress:'
    };

    let currentBookKey = null;
    let currentBookName = '';
    let lastProgressSaveAt = 0;

    const readStorage = (key, fallbackValue = null) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallbackValue;
        } catch (error) {
            console.warn(`Could not read storage key "${key}":`, error);
            return fallbackValue;
        }
    };

    const writeStorage = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`Could not write storage key "${key}":`, error);
        }
    };

    const removeStorage = (key) => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn(`Could not remove storage key "${key}":`, error);
        }
    };

    const getBookStorageKey = (file) => {
        return `${file.name}:${file.size}:${file.lastModified}`;
    };

    const getProgressStorageKey = (bookKey) => {
        return `${STORAGE_KEYS.progressPrefix}${bookKey}`;
    };

    const saveSettings = () => {
        writeStorage(STORAGE_KEYS.settings, {
            wpm: okuyucu.hedefWPM,
            smartSpeedEnabled: okuyucu.smartSpeedEnabled,
            chunkSize: okuyucu.chunkSize
        });
    };

    const saveProgress = (force = false) => {
        if (!currentBookKey || okuyucu.kelimeler.length === 0) return;

        const now = Date.now();
        if (!force && now - lastProgressSaveAt < 1000) return;
        lastProgressSaveAt = now;

        writeStorage(getProgressStorageKey(currentBookKey), {
            bookName: currentBookName,
            index: okuyucu.guncelIndeks,
            totalWords: okuyucu.kelimeler.length,
            wpm: okuyucu.hedefWPM,
            smartSpeedEnabled: okuyucu.smartSpeedEnabled,
            chunkSize: okuyucu.chunkSize,
            updatedAt: new Date().toISOString()
        });
    };

    const updateWpmDisplays = () => {
        const label = `${okuyucu.hedefWPM} WPM`;
        if (wpmDisplay) wpmDisplay.textContent = label;
        if (fsWpmDisplay) fsWpmDisplay.textContent = label;
    };

    const savedSettings = readStorage(STORAGE_KEYS.settings);
    if (savedSettings) {
        const savedWpm = parseInt(savedSettings.wpm, 10);
        if (!isNaN(savedWpm) && savedWpm > 0) {
            okuyucu.hizGuncelle(savedWpm);
            if (wpmSlider) wpmSlider.value = savedWpm;
            updateWpmDisplays();
        }

        if (typeof savedSettings.smartSpeedEnabled === 'boolean') {
            okuyucu.setSmartSpeed(savedSettings.smartSpeedEnabled);
            if (smartSpeedToggle) smartSpeedToggle.checked = savedSettings.smartSpeedEnabled;
        }

        const savedChunkSize = parseInt(savedSettings.chunkSize, 10);
        if (!isNaN(savedChunkSize)) {
            okuyucu.setChunkSize(savedChunkSize);
            if (chunkSizeSelect) chunkSizeSelect.value = String(okuyucu.chunkSize);
        }
    }

    const formatNumber = (value) => value.toLocaleString('en-US');

    const formatRemainingTime = (remainingWords) => {
        if (remainingWords <= 0) return 'Done';

        const minutes = remainingWords / okuyucu.hedefWPM;
        if (minutes < 1) return '<1 min';
        if (minutes < 60) return `${Math.ceil(minutes)} min`;

        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    const updateReadingStats = () => {
        const totalWords = okuyucu.kelimeler.length;

        if (totalWords === 0) {
            if (progressFill) progressFill.style.width = '0%';
            if (progressPercent) progressPercent.textContent = '0%';
            if (progressWords) progressWords.textContent = '0 / 0';
            if (remainingTime) remainingTime.textContent = '0 min';
            if (progressFill && progressFill.parentElement) {
                progressFill.parentElement.setAttribute('aria-valuenow', '0');
            }
            return;
        }

        const currentPosition = Math.min(okuyucu.guncelIndeks + okuyucu.chunkSize, totalWords);
        const percentValue = Math.min(100, Math.max(0, (currentPosition / totalWords) * 100));
        const roundedPercent = Math.round(percentValue);
        const remainingWords = Math.max(totalWords - currentPosition, 0);

        if (progressFill) progressFill.style.width = `${percentValue}%`;
        if (progressPercent) progressPercent.textContent = `${roundedPercent}%`;
        if (progressWords) progressWords.textContent = `${formatNumber(currentPosition)} / ${formatNumber(totalWords)}`;
        if (remainingTime) remainingTime.textContent = formatRemainingTime(remainingWords);
        if (progressFill && progressFill.parentElement) {
            progressFill.parentElement.setAttribute('aria-valuenow', String(roundedPercent));
        }
    };

    const updatePlaybackLabels = () => {
        const label = okuyucu.okuyorMu ? 'Pause reading' : 'Play reading';
        if (playPauseBtn) playPauseBtn.setAttribute('aria-label', label);
        if (fsPlayPauseBtn) fsPlayPauseBtn.setAttribute('aria-label', label);
    };

    const canUsePausedControls = () => {
        return okuyucu.kelimeler.length > 0 && !okuyucu.okuyorMu;
    };

    const updateFullscreenControlState = () => {
        const hasBook = okuyucu.kelimeler.length > 0;
        const canUseTouchShortcuts = canUsePausedControls();

        if (fsPlayPauseBtn) fsPlayPauseBtn.disabled = !hasBook;
        [fsPrevWordBtn, fsNextWordBtn, fsWpmDownBtn, fsWpmUpBtn].forEach((button) => {
            if (button) button.disabled = !canUseTouchShortcuts;
        });
    };

    const isTypingTarget = (target) => {
        if (!target) return false;
        const tagName = target.tagName;
        if (tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable) return true;
        if (tagName !== 'INPUT') return false;

        const textInputTypes = ['email', 'number', 'password', 'search', 'tel', 'text', 'url'];
        return textInputTypes.includes((target.type || 'text').toLowerCase());
    };

    const jumpByWords = (delta) => {
        if (!okuyucu.kelimeler.length) return;
        const nextIndex = Math.min(Math.max(okuyucu.guncelIndeks + delta, 0), okuyucu.kelimeler.length - 1);
        okuyucu.setIndex(nextIndex);
        saveProgress(true);
    };

    const jumpByChunks = (delta) => {
        jumpByWords(delta * okuyucu.chunkSize);
    };

    const adjustWpm = (delta) => {
        if (!wpmSlider) return;

        const min = parseInt(wpmSlider.min, 10);
        const max = parseInt(wpmSlider.max, 10);
        const current = parseInt(wpmSlider.value, 10);
        const nextValue = Math.min(Math.max(current + delta, min), max);

        wpmSlider.value = nextValue;
        okuyucu.hizGuncelle(nextValue);
        updateWpmDisplays();
        updateReadingStats();
        saveSettings();
        saveProgress(true);
    };

    const toggleFullscreen = () => {
        if (!readerWrapper) return;

        if (!document.fullscreenElement) {
            readerWrapper.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    okuyucu.onIndexChange = (idx) => {
        if (wordCounterValue) wordCounterValue.textContent = idx;
        if (wordIndexInput && document.activeElement !== wordIndexInput) {
            wordIndexInput.value = idx;
        }
        updateReadingStats();
        saveProgress();
    };

    if (copyWordIndexBtn) {
        copyWordIndexBtn.addEventListener('click', async () => {
            const value = String(okuyucu.guncelIndeks);
            try {
                await navigator.clipboard.writeText(value);
            } catch (err) {
                const ta = document.createElement('textarea');
                ta.value = value;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            const original = copyWordIndexBtn.textContent;
            copyWordIndexBtn.textContent = '✓';
            setTimeout(() => { copyWordIndexBtn.textContent = original; }, 1200);
        });
    }

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
            const bookKey = getBookStorageKey(file);
            okuyucu.pause();
            saveProgress(true);
            currentBookKey = null;
            currentBookName = '';

            // İşlem yükünü Parser modülüne devret (Returns { words, chapters })
            const result = await dosyaOkuVeKelimelereAyir(file);
            
            // Sonucu okuma motoruna yükle
            okuyucu.metinYukle(result.words);
            currentBookKey = bookKey;
            currentBookName = file.name;

            // Arayüz kontrollerini (Chapters/Words) güncelle
            if (navControls) navControls.style.display = 'flex';
            if (readingStats) readingStats.classList.remove('is-hidden');
            
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
            if (readerWrapper) readerWrapper.classList.add('paused');
            updateFullscreenControlState();

            const savedProgress = readStorage(getProgressStorageKey(currentBookKey));
            if (savedProgress) {
                const savedWpm = parseInt(savedProgress.wpm, 10);
                if (!isNaN(savedWpm) && savedWpm > 0) {
                    okuyucu.hizGuncelle(savedWpm);
                    if (wpmSlider) wpmSlider.value = savedWpm;
                    updateWpmDisplays();
                }

                if (typeof savedProgress.smartSpeedEnabled === 'boolean') {
                    okuyucu.setSmartSpeed(savedProgress.smartSpeedEnabled);
                    if (smartSpeedToggle) smartSpeedToggle.checked = savedProgress.smartSpeedEnabled;
                }

                const savedChunkSize = parseInt(savedProgress.chunkSize, 10);
                if (!isNaN(savedChunkSize)) {
                    okuyucu.setChunkSize(savedChunkSize);
                    if (chunkSizeSelect) chunkSizeSelect.value = String(okuyucu.chunkSize);
                }
            }

            if (savedProgress && Number.isInteger(savedProgress.index) && savedProgress.index > 0 && savedProgress.index < result.words.length) {
                okuyucu.setIndex(savedProgress.index);
                if (wordIndexInput) wordIndexInput.value = savedProgress.index;
            } else {
                updateReadingStats();
                saveProgress(true);
            }
            
            console.log(`${result.words.length} words loaded successfully.`);
        } catch (error) {
            currentBookKey = null;
            currentBookName = '';
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
            saveProgress(true);
        });
    }

    // Word Index Input Change (Kelime/Sayfa Numarası Değişimi)
    if (wordIndexInput) {
        wordIndexInput.addEventListener('change', (event) => {
            let startIndex = parseInt(event.target.value, 10);
            if (startIndex < 0) startIndex = 0;
            okuyucu.setIndex(startIndex);
            saveProgress(true);
            
            // Eğer girilen index bir chapter başlangıcına denk geliyorsa dropdown'u da güncellemek güzel olur
            // Şimdilik sadece index'e atlıyoruz.
        });
    }

    // 2. Okuma Hızı (WPM) Değiştirme İşlemi (Slider)
    if (wpmSlider) {
        wpmSlider.addEventListener('input', (event) => {
            const yeniHiz = parseInt(event.target.value, 10);
            if (!isNaN(yeniHiz) && yeniHiz > 0) {
                // Okuma hızını algoritmaya ilet
                okuyucu.hizGuncelle(yeniHiz);
                updateWpmDisplays();
                updateReadingStats();
                saveSettings();
                saveProgress(true);
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
                saveProgress(true);
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
            saveProgress(true);
            if (playPauseIcon) playPauseIcon.textContent = '▶';
            if (playPauseText) playPauseText.textContent = 'Play';
            if (playPauseBtn) {
                playPauseBtn.classList.remove('btn-pause');
                playPauseBtn.classList.add('btn-play');
            }
            if (fsPlayPauseBtn) fsPlayPauseBtn.textContent = '▶ Play';
            updatePlaybackLabels();
            updateFullscreenControlState();
            // Tam ekranda durduğunda word-counter (copy) görünsün
            if (readerWrapper) readerWrapper.classList.add('paused');
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
            updatePlaybackLabels();
            updateFullscreenControlState();
            // Okuma başlayınca word-counter'ı gizle
            if (readerWrapper) readerWrapper.classList.remove('paused');
        }
    };

    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (fsPlayPauseBtn) fsPlayPauseBtn.addEventListener('click', togglePlayPause);
    if (fsPrevWordBtn) fsPrevWordBtn.addEventListener('click', () => {
        if (canUsePausedControls()) jumpByChunks(-1);
    });
    if (fsNextWordBtn) fsNextWordBtn.addEventListener('click', () => {
        if (canUsePausedControls()) jumpByChunks(1);
    });
    if (fsWpmDownBtn) fsWpmDownBtn.addEventListener('click', () => {
        if (canUsePausedControls()) adjustWpm(-10);
    });
    if (fsWpmUpBtn) fsWpmUpBtn.addEventListener('click', () => {
        if (canUsePausedControls()) adjustWpm(10);
    });

    updatePlaybackLabels();
    updateFullscreenControlState();

    // Klavye kısayolları: Space play/pause, oklar gezinme ve hız, F fullscreen.
    document.addEventListener('keydown', (e) => {
        if (isTypingTarget(e.target)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        if (e.code === 'Space') {
            e.preventDefault();
            if (okuyucu.kelimeler.length > 0) togglePlayPause();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            if (canUsePausedControls()) jumpByChunks(e.shiftKey ? 10 : 1);
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            if (canUsePausedControls()) jumpByChunks(e.shiftKey ? -10 : -1);
        } else if (e.code === 'ArrowUp') {
            e.preventDefault();
            adjustWpm(10);
        } else if (e.code === 'ArrowDown') {
            e.preventDefault();
            adjustWpm(-10);
        } else if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            toggleFullscreen();
        }
    }, true);

    // 5. "Sıfırla" (Reset) İşlemi
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const progressKeyToClear = currentBookKey ? getProgressStorageKey(currentBookKey) : null;
            currentBookKey = null;
            currentBookName = '';
            okuyucu.reset();
            if (progressKeyToClear) removeStorage(progressKeyToClear);
            
            // Arayüzü başlangıç haline (kitap yüklenmemiş duruma) döndür
            if (fileInput) fileInput.value = '';
            if (uploadText) uploadText.textContent = '📁 Select Book (.txt, .epub)';
            if (navControls) navControls.style.display = 'none';
            if (readingStats) readingStats.classList.add('is-hidden');
            updateReadingStats();
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
                updatePlaybackLabels();
            }
            if (fsPlayPauseBtn) {
                fsPlayPauseBtn.textContent = '▶ Play';
                fsPlayPauseBtn.disabled = true;
            }
            if (readerWrapper) readerWrapper.classList.remove('paused');
            updateFullscreenControlState();
        });
    }

    // 6. Smart Speed Toggle (Akıllı Hızlanma Aç/Kapat)
    if (smartSpeedToggle) {
        smartSpeedToggle.addEventListener('change', (event) => {
            okuyucu.setSmartSpeed(event.target.checked);
            saveSettings();
            saveProgress(true);
        });
    }

    if (chunkSizeSelect) {
        chunkSizeSelect.addEventListener('change', (event) => {
            okuyucu.setChunkSize(event.target.value);
            chunkSizeSelect.value = String(okuyucu.chunkSize);
            updateReadingStats();
            saveSettings();
            saveProgress(true);
        });
    }

    window.addEventListener('beforeunload', () => {
        saveProgress(true);
    });

    // 7. Fullscreen Toggle (Tam Ekran)
    if (fullscreenBtn && readerWrapper) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        
        // Tam ekran durumu değiştiğinde ikon güncelleme (Opsiyonel)
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                fullscreenBtn.textContent = '✕';
                fullscreenBtn.title = 'Exit Fullscreen';
                fullscreenBtn.setAttribute('aria-label', 'Exit fullscreen');
            } else {
                fullscreenBtn.textContent = '⛶';
                fullscreenBtn.title = 'Toggle Fullscreen';
                fullscreenBtn.setAttribute('aria-label', 'Enter fullscreen');
            }
        });
    }

    // 8. Dark Mode Toggle (Tam Ekranda Karanlık/Aydınlık Mod)
    const fsDarkModeBtn = document.getElementById('fsDarkModeBtn');
    if (fsDarkModeBtn && readerWrapper) {
        fsDarkModeBtn.addEventListener('click', () => {
            readerWrapper.classList.toggle('fs-dark');
            const isDark = readerWrapper.classList.contains('fs-dark');
            fsDarkModeBtn.textContent = isDark ? '☀️' : '🌙';
            fsDarkModeBtn.title = isDark ? 'Light Mode' : 'Dark Mode';
            fsDarkModeBtn.setAttribute('aria-label', isDark ? 'Switch to light fullscreen theme' : 'Switch to dark fullscreen theme');
        });
    }
});
