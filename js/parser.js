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

function parseXml(xmlString, errorMessage) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    if (doc.querySelector("parsererror")) {
        throw new Error(errorMessage);
    }

    return doc;
}

function getElementsByLocalName(root, localName) {
    return Array.from(root.getElementsByTagName("*"))
        .filter(element => element.localName === localName);
}

function safeDecodePath(path) {
    try {
        return decodeURIComponent(path);
    } catch (error) {
        return path;
    }
}

function getZipFile(zip, path) {
    return zip.file(path) || zip.file(safeDecodePath(path));
}

function normalizeZipPath(path) {
    const parts = [];

    path.split('/').forEach((part) => {
        if (!part || part === '.') return;
        if (part === '..') {
            parts.pop();
            return;
        }
        parts.push(part);
    });

    return parts.join('/');
}

function resolveEpubPath(baseDir, href) {
    const withoutFragment = href.split('#')[0];
    return normalizeZipPath(baseDir + safeDecodePath(withoutFragment));
}

function getChapterTitle(doc, fallbackTitle) {
    const heading = doc.querySelector('h1, h2, h3, title');
    const title = heading ? heading.textContent.trim() : '';
    if (!title) return fallbackTitle;

    const decoder = document.createElement('textarea');
    decoder.innerHTML = title;
    return decoder.value;
}

function extractReadableText(doc, fallbackText) {
    doc.querySelectorAll('script, style, noscript').forEach(element => element.remove());

    const source = doc.body || doc.documentElement;
    const text = source ? source.textContent : fallbackText;
    return text.replace(/\s+/g, ' ').trim();
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
        const containerDoc = parseXml(containerXml, "Invalid EPUB: container.xml could not be parsed.");
        const rootfile = getElementsByLocalName(containerDoc, "rootfile")
            .find(element => element.getAttribute("full-path"));
        if (!rootfile) throw new Error("Invalid EPUB: OPF path not found.");
        const opfPath = rootfile.getAttribute("full-path");

        // 2. Read OPF file
        const opfFile = getZipFile(zip, opfPath);
        if (!opfFile) throw new Error("Invalid EPUB: OPF file missing.");
        const opfXml = await opfFile.async("string");
        const opfDoc = parseXml(opfXml, "Invalid EPUB: OPF file could not be parsed.");

        const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

        // 3. Extract manifest (id -> href)
        const manifest = {};
        getElementsByLocalName(opfDoc, "item").forEach((item) => {
            const id = item.getAttribute("id");
            const href = item.getAttribute("href");
            const mediaType = item.getAttribute("media-type") || "";
            if (id && href) {
                manifest[id] = { href, mediaType };
            }
        });

        // 4. Extract reading order (spine)
        const spine = [];
        getElementsByLocalName(opfDoc, "itemref").forEach((itemref) => {
            const idref = itemref.getAttribute("idref");
            const linear = (itemref.getAttribute("linear") || "").toLowerCase();
            if (idref && linear !== "no") {
                spine.push(idref);
            }
        });

        // 5. Read HTML files sequentially, extract chapters and words
        const chapters = [];
        const wordsArray = [];
        let globalWordIndex = 0;

        for (const idref of spine) {
            const manifestItem = manifest[idref];
            if (manifestItem) {
                const { href, mediaType } = manifestItem;
                const isReadableDocument = !mediaType || /html/i.test(mediaType);
                if (!isReadableDocument) continue;

                const filePath = resolveEpubPath(opfDir, href);
                const htmlFile = getZipFile(zip, filePath);
                
                if (htmlFile) {
                    const htmlStr = await htmlFile.async("string");
                    
                    // Parse HTML string to DOM
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlStr, "text/html");

                    // Find chapter title (fallback to generic name)
                    const chapterTitle = getChapterTitle(doc, `Chapter ${chapters.length + 1}`);
                    const cleanText = extractReadableText(doc, htmlStr);

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
