/**
 * Verilen kelimeyi ORP (Optimal Recognition Point) noktasına göre ayırır,
 * ORP harfini kırmızı (veya ikileme ise mor) yapar ve bu harf her zaman merkezde olacak şekilde HTML'e çizer.
 * 
 * @param {string} kelime - Ekranda gösterilecek kelime
 * @param {HTMLElement} containerElement - Kelimenin yazdırılacağı HTML div elementi
 * @param {boolean} isRepeat - Ardışık aynı kelime mi? (ikileme tespiti)
 */
export function kelimeyiEkranaYaz(kelime, containerElement, isRepeat = false) {
    if (!kelime || !containerElement) return;

    const len = kelime.length;

    // "Tam ortasındaki harfin solundaki harfi" kuralına göre ORP hesaplaması:
    // Örneğin 5 harfli kelime "sonra" (0,1,2,3,4) -> tam ortası index 2 ('n'). Solundaki index 1 ('o').
    // 1 harfli ise indeks 0 olacağı için eksiye düşmemesi adına Math.max kullanıyoruz.
    const centerIndex = Math.floor(len / 2);
    const orpIndex = Math.max(0, centerIndex - 1);

    // Kelimeyi ORP noktasına göre 3 parçaya bölüyoruz
    const solKisim = kelime.substring(0, orpIndex);
    const orpHarfi = kelime.charAt(orpIndex);
    const sagKisim = kelime.substring(orpIndex + 1);

    // İkileme durumunda ORP harfi mor (#8b5cf6), normal durumda kırmızı
    const orpColor = isRepeat ? '#8b5cf6' : 'red';

    const wordDisplay = document.createElement('div');
    wordDisplay.className = 'word-display';
    wordDisplay.style.display = 'flex';
    wordDisplay.style.justifyContent = 'center';
    wordDisplay.style.alignItems = 'center';
    wordDisplay.style.width = '100%';
    wordDisplay.style.height = '100%';

    const leftPart = document.createElement('span');
    leftPart.style.flex = '1';
    leftPart.style.textAlign = 'right';
    leftPart.textContent = solKisim;

    const orpLetter = document.createElement('span');
    orpLetter.style.color = orpColor;
    orpLetter.textContent = orpHarfi;

    const rightPart = document.createElement('span');
    rightPart.style.flex = '1';
    rightPart.style.textAlign = 'left';
    rightPart.textContent = sagKisim;

    wordDisplay.append(leftPart, orpLetter, rightPart);
    containerElement.replaceChildren(wordDisplay);
}
