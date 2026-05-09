/**
 * Reads a loaded file, extracts its text into an array of words,
 * and builds a Table of Contents (Chapters / Pages) with word index offsets.
 * Supports .txt and .epub files.
 * 
 * @param {File} file - The file object from the file input
 * @returns {Promise<{words: string[], chapters: {title: string, startIndex: number}[]}>}
 */
export async function dosyaOkuVeKelimelereAyir(file) {
    if (!file) {
        throw new Error("No valid file found.");
    }

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.epub')) {
        return parseEpub(file);
    } else {
        return parseTxt(file);
    }
}

/**
 * Parses a TXT file into words and creates virtual pages every 500 words.
 */
function parseTxt(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const text = event.target.result;
            const wordsArray = text
                .split(/\s+/)
                .filter(word => word.trim().length > 0);
            
            const chapters = [];
            // Create a virtual chapter/page every 500 words
            for (let i = 0; i < wordsArray.length; i += 500) {
                chapters.push({
                    title: `Page ${Math.floor(i / 500) + 1}`,
                    startIndex: i
                });
            }

            resolve({ words: wordsArray, chapters: chapters });
        };

        reader.onerror = (error) => reject(new Error("Error reading TXT: " + error));
        reader.readAsText(file);
    });
}

/**
 * Parses an EPUB file, extracting text from HTML files in spine order.
 * Extracts headings for chapter titles and builds word index offsets.
 * (Requires JSZip)
 */
async function parseEpub(file) {
    if (typeof JSZip === 'undefined') {
        throw new Error("JSZip library is missing for EPUB parsing.");
    }

    try {
        const zip = await JSZip.loadAsync(file);

        // 1. Read container.xml to find the OPF file path
        const containerFile = zip.file("META-INF/container.xml");
        if (!containerFile) throw new Error("Invalid EPUB: container.xml not found.");
        const containerXml = await containerFile.async("string");

        const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/);
        if (!rootfileMatch) throw new Error("Invalid EPUB: OPF path not found.");
        const opfPath = rootfileMatch[1];

        // 2. Read OPF file
        const opfFile = zip.file(opfPath);
        if (!opfFile) throw new Error("Invalid EPUB: OPF file missing.");
        const opfXml = await opfFile.async("string");

        const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

        // 3. Extract manifest (id -> href)
        const manifest = {};
        const itemRegex = /<item\s+([^>]+)>/gi;
        let itemMatch;
        while ((itemMatch = itemRegex.exec(opfXml)) !== null) {
            const attrStr = itemMatch[1];
            const idM = attrStr.match(/id=["']([^"']+)["']/);
            const hrefM = attrStr.match(/href=["']([^"']+)["']/);
            if (idM && hrefM) {
                manifest[idM[1]] = hrefM[1];
            }
        }

        // 4. Extract reading order (spine)
        const spineRegex = /<itemref\s+[^>]*idref=["']([^"']+)["'][^>]*>/gi;
        const spine = [];
        let spineMatch;
        while ((spineMatch = spineRegex.exec(opfXml)) !== null) {
            spine.push(spineMatch[1]);
        }

        // 5. Read HTML files sequentially, extract chapters and words
        const chapters = [];
        const wordsArray = [];
        let globalWordIndex = 0;

        for (const idref of spine) {
            const href = manifest[idref];
            if (href) {
                const filePath = opfDir + decodeURIComponent(href);
                const htmlFile = zip.file(filePath);
                
                if (htmlFile) {
                    const htmlStr = await htmlFile.async("string");
                    
                    // Parse HTML string to DOM
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlStr, "text/html");

                    // Find chapter title (fallback to generic name)
                    let chapterTitle = `Chapter ${chapters.length + 1}`;
                    const heading = doc.querySelector('h1, h2, h3, title');
                    if (heading && heading.textContent.trim()) {
                        chapterTitle = heading.textContent.trim();
                    }
                    
                    // Do not add empty chapters
                    const bodyContent = doc.body ? doc.body.innerHTML : htmlStr;
                    
                    // Clean tags
                    const cleanText = bodyContent
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/&nbsp;/gi, ' ')
                        .replace(/&[a-z0-9]+;/gi, ' ');

                    const fileWords = cleanText.split(/\s+/).filter(k => k.trim().length > 0);
                    
                    if (fileWords.length > 0) {
                        chapters.push({
                            title: chapterTitle,
                            startIndex: globalWordIndex
                        });
                        wordsArray.push(...fileWords);
                        globalWordIndex += fileWords.length;
                    }
                }
            }
        }

        return { words: wordsArray, chapters: chapters };

    } catch (error) {
        throw new Error("Error parsing EPUB: " + error.message);
    }
}
