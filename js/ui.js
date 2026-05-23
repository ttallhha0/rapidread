/**
 * Verilen kelimeyi ORP (Optimal Recognition Point) noktasına göre ayırır,
 * ORP harfini kırmızı yapar ve bu harf her zaman merkezde olacak şekilde HTML'e çizer.
 * 
 * @param {string} kelime - Ekranda gösterilecek kelime
 * @param {HTMLElement} containerElement - Kelimenin yazdırılacağı HTML div elementi
 */
export function kelimeyiEkranaYaz(kelime, containerElement) {
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

    // Flexbox ve `flex: 1` mantığıyla sağ ve sol boşlukları eşitleyerek
    // ortadaki kırmızı harfi (ORP) tam merkeze hizalıyoruz.
    containerElement.innerHTML = `
        <div class="word-display" style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">
            <span style="flex: 1; text-align: right;">${solKisim}</span>
            <span style="color: red;">${orpHarfi}</span>
            <span style="flex: 1; text-align: left;">${sagKisim}</span>
        </div>
    `;
}
