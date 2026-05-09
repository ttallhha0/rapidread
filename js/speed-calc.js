/**
 * Calculates the display duration of a word in milliseconds.
 * 
 * @param {string} kelime - The word to be displayed
 * @param {number} hedefWPM - Target reading speed (Words Per Minute)
 * @param {string[]} commonWordsArray - Array of common words for the detected language
 * @param {boolean} isSmart - Whether to apply dynamic speed pacing (defaults to true)
 * @returns {number} - Display duration in ms
 */
export function hesaplaKelimeSuresi(kelime, hedefWPM, commonWordsArray, isSmart = true) {
    // Base duration: 1 minute = 60,000 milliseconds
    // Formula: 60000 / WPM = basic time per word
    let sure = 60000 / hedefWPM;

    // If Smart Speed is disabled, return strict robotic pacing immediately
    if (!isSmart) {
        return Math.round(sure);
    }

    // Check if the word ends with punctuation (dot or comma)
    const sonundaNoktaVeyaVirgulVarMi = /[.,]$/.test(kelime);

    // Clean the word to check length and if it's common
    // (Remove trailing punctuation and lowercase it)
    const temizKelime = kelime.replace(/[.,!?;:]+$/, '').toLowerCase();

    // Rule 1: Shorten duration by 15% if the word is common in the detected language
    if (commonWordsArray.includes(temizKelime)) {
        sure *= 0.85; // 15% faster
    }

    // Rule 2: Increase duration by 20% if the word is longer than 10 characters
    if (temizKelime.length > 10) {
        sure *= 1.20; // 20% slower
    }

    // Rule 3: Double the duration if the word ends with a dot or a comma
    if (sonundaNoktaVeyaVirgulVarMi) {
        sure *= 2; // 2x slower
    }

    // Return as rounded integer
    return Math.round(sure);
}
