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
            const wordsArray = [];
            const detectedChapters = [];
            const lines = text.replace(/\r\n?/g, '\n').split('\n');
            
            lines.forEach((line, index) => {
                const trimmedLine = line.trim();
                const previousLine = index > 0 ? lines[index - 1].trim() : '';
                const nextLine = index < lines.length - 1 ? lines[index + 1].trim() : '';

                if (isLikelyTxtChapterHeading(trimmedLine, previousLine, nextLine, wordsArray.length)) {
                    addChapter(detectedChapters, normalizeTitle(trimmedLine), wordsArray.length);
                }

                wordsArray.push(...splitWords(trimmedLine));
            });

            const chapters = detectedChapters.length > 0
                ? detectedChapters
                : createVirtualPages(wordsArray.length);

            resolve({ words: wordsArray, chapters: chapters });
        };

        reader.onerror = (error) => reject(new Error("Error reading TXT: " + error));
        reader.readAsText(file);
    });
}

function splitWords(text) {
    return (text || '')
        .split(/\s+/)
        .filter(word => word.trim().length > 0);
}

function normalizeWhitespace(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function normalizeTitle(title) {
    return normalizeWhitespace(decodeHtmlEntities(title));
}

function createVirtualPages(totalWords, pageSize = 500) {
    const chapters = [];
    for (let i = 0; i < totalWords; i += pageSize) {
        chapters.push({
            title: `Page ${Math.floor(i / pageSize) + 1}`,
            startIndex: i
        });
    }
    return chapters;
}

function addChapter(chapters, title, startIndex) {
    const cleanTitle = normalizeTitle(title);
    if (!cleanTitle) return;

    const previous = chapters[chapters.length - 1];
    if (previous && previous.startIndex === startIndex) {
        previous.title = cleanTitle;
        return;
    }

    chapters.push({
        title: cleanTitle,
        startIndex
    });
}

function isLikelyTxtChapterHeading(line, previousLine, nextLine, currentWordIndex) {
    if (!line || line.length < 2 || line.length > 120) return false;

    const words = splitWords(line);
    if (words.length === 0 || words.length > 14) return false;

    const normalized = line.normalize('NFKC');
    const lower = normalized.toLocaleLowerCase('tr-TR');
    const isSeparated = currentWordIndex === 0 || (!previousLine && !!nextLine);
    const endsLikeSentence = /[.!?;]$/.test(normalized);

    if (/^(chapter|section|part|book|volume|prologue|epilogue|introduction|appendix)\b/i.test(normalized)) return true;
    if (/^(bölüm|bolum|kısım|kisim|kitap|cilt|önsöz|onsoz|sonsöz|sonsoz|giriş|giris|ek)\b/i.test(lower)) return true;
    if (/^([ivxlcdm]+|\d+)([.)-])?\s+[\p{L}\p{N}]/iu.test(normalized) && words.length <= 10 && !endsLikeSentence) return true;
    if (/^[\p{Lu}\d\s'"“”‘’.,:;!?-]{3,}$/u.test(normalized) && words.length <= 10 && isSeparated) return true;

    return isSeparated && words.length <= 8 && !endsLikeSentence && /^[\p{L}\p{N}'"“”‘’(]/u.test(normalized);
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

function splitEpubHref(baseDir, href) {
    const [pathPart, fragment = ''] = href.split('#');
    return {
        filePath: normalizeZipPath(baseDir + safeDecodePath(pathPart)),
        fragment: safeDecodePath(fragment)
    };
}

function decodeHtmlEntities(text) {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = text || '';
    return decoder.value;
}

function getChapterTitle(doc, fallbackTitle) {
    const heading = doc.querySelector('h1, h2, h3, title');
    const title = heading ? heading.textContent.trim() : '';
    if (!title) return fallbackTitle;

    return decodeHtmlEntities(title);
}

function extractReadableText(doc, fallbackText) {
    doc.querySelectorAll('script, style, noscript').forEach(element => element.remove());

    const source = doc.body || doc.documentElement;
    const text = source ? source.textContent : fallbackText;
    return text.replace(/\s+/g, ' ').trim();
}

function findEpubNavItem(manifest) {
    return Object.values(manifest).find((item) => {
        const properties = (item.properties || '').toLowerCase().split(/\s+/);
        return properties.includes('nav');
    });
}

function findEpubNcxItem(manifest, spineTocId) {
    if (spineTocId && manifest[spineTocId]) return manifest[spineTocId];

    return Object.values(manifest).find((item) => {
        return /dtbncx|ncx/i.test(item.mediaType || '') || /\.ncx$/i.test(item.href || '');
    });
}

async function extractNavTocEntries(zip, opfDir, manifest) {
    const navItem = findEpubNavItem(manifest);
    if (!navItem) return [];

    const navPath = resolveEpubPath(opfDir, navItem.href);
    const navFile = getZipFile(zip, navPath);
    if (!navFile) return [];

    const navHtml = await navFile.async("string");
    const parser = new DOMParser();
    const navDoc = parser.parseFromString(navHtml, "text/html");
    const navDir = navPath.includes('/') ? navPath.substring(0, navPath.lastIndexOf('/') + 1) : '';
    const navElements = Array.from(navDoc.querySelectorAll('nav'));
    const tocNav = navElements.find((nav) => {
        const type = `${nav.getAttribute('epub:type') || ''} ${nav.getAttribute('type') || ''}`.toLowerCase();
        return type.includes('toc');
    }) || navElements[0];

    if (!tocNav) return [];

    return Array.from(tocNav.querySelectorAll('a[href]')).map((link) => {
        const href = link.getAttribute('href');
        const target = splitEpubHref(navDir, href);
        return {
            ...target,
            title: normalizeTitle(link.textContent)
        };
    }).filter(entry => entry.title && entry.filePath);
}

async function extractNcxTocEntries(zip, opfDir, manifest, spineTocId) {
    const ncxItem = findEpubNcxItem(manifest, spineTocId);
    if (!ncxItem) return [];

    const ncxPath = resolveEpubPath(opfDir, ncxItem.href);
    const ncxFile = getZipFile(zip, ncxPath);
    if (!ncxFile) return [];

    const ncxXml = await ncxFile.async("string");
    const ncxDoc = parseXml(ncxXml, "Invalid EPUB: NCX table of contents could not be parsed.");
    const ncxDir = ncxPath.includes('/') ? ncxPath.substring(0, ncxPath.lastIndexOf('/') + 1) : '';

    return getElementsByLocalName(ncxDoc, "navPoint").map((navPoint) => {
        const textElement = getElementsByLocalName(navPoint, "text")[0];
        const contentElement = getElementsByLocalName(navPoint, "content")[0];
        const src = contentElement ? contentElement.getAttribute("src") : '';
        const target = splitEpubHref(ncxDir, src);
        return {
            ...target,
            title: normalizeTitle(textElement ? textElement.textContent : '')
        };
    }).filter(entry => entry.title && entry.filePath);
}

function findElementByFragment(doc, fragment) {
    if (!fragment) return null;

    const directMatch = doc.getElementById(fragment);
    if (directMatch) return directMatch;

    return Array.from(doc.querySelectorAll('[id], [name]')).find((element) => {
        return element.getAttribute('id') === fragment || element.getAttribute('name') === fragment;
    }) || null;
}

function countWordsBeforeElement(root, targetElement) {
    if (!root || !targetElement) return 0;

    let count = 0;
    let found = false;
    const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);

    const walk = (node) => {
        if (!node || found) return;
        if (node === targetElement) {
            found = true;
            return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            count += splitWords(node.textContent).length;
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE || ignoredTags.has(node.tagName)) return;
        Array.from(node.childNodes).forEach(walk);
    };

    walk(root);
    return count;
}

function getHeadingLevel(heading) {
    const tagMatch = heading.tagName.match(/^H([1-6])$/i);
    if (tagMatch) return parseInt(tagMatch[1], 10);

    const ariaLevel = parseInt(heading.getAttribute('aria-level'), 10);
    return !isNaN(ariaLevel) ? ariaLevel : 6;
}

function getDocumentHeadingChapters(docInfo) {
    const headings = Array.from(docInfo.doc.querySelectorAll('h1, h2, h3, [role="heading"]'))
        .map((heading) => ({
            heading,
            title: normalizeTitle(heading.textContent),
            level: getHeadingLevel(heading)
        }))
        .filter(candidate => candidate.title && candidate.title.length <= 140);

    if (headings.length === 0) return [];

    const bestLevel = Math.min(...headings.map(candidate => candidate.level));
    return headings
        .filter(candidate => candidate.level === bestLevel)
        .map((candidate) => ({
            title: candidate.title,
            startIndex: docInfo.startIndex + countWordsBeforeElement(docInfo.doc.body || docInfo.doc.documentElement, candidate.heading)
        }));
}

function buildChaptersFromToc(tocEntries, documentInfos) {
    const chapters = [];
    const documentsByPath = new Map(documentInfos.map(info => [info.filePath, info]));

    tocEntries.forEach((entry) => {
        const docInfo = documentsByPath.get(entry.filePath);
        if (!docInfo) return;

        const targetElement = findElementByFragment(docInfo.doc, entry.fragment);
        const localOffset = targetElement
            ? countWordsBeforeElement(docInfo.doc.body || docInfo.doc.documentElement, targetElement)
            : 0;

        addChapter(chapters, entry.title, docInfo.startIndex + localOffset);
    });

    return chapters;
}

function buildChaptersFromHeadings(documentInfos) {
    const chapters = [];

    documentInfos.forEach((docInfo) => {
        const headingChapters = getDocumentHeadingChapters(docInfo);
        if (headingChapters.length > 0) {
            headingChapters.forEach(chapter => addChapter(chapters, chapter.title, chapter.startIndex));
        } else {
            addChapter(chapters, getChapterTitle(docInfo.doc, `Chapter ${chapters.length + 1}`), docInfo.startIndex);
        }
    });

    return chapters;
}

function finalizeChapters(chapters, totalWords) {
    const seen = new Set();

    const uniqueChapters = chapters
        .filter(chapter => Number.isInteger(chapter.startIndex) && chapter.startIndex >= 0 && chapter.startIndex < totalWords)
        .sort((a, b) => a.startIndex - b.startIndex)
        .filter((chapter) => {
            if (seen.has(chapter.startIndex)) return false;
            seen.add(chapter.startIndex);
            return true;
        });

    if (uniqueChapters.length === 0) return createVirtualPages(totalWords);
    if (uniqueChapters[0].startIndex > 0) {
        uniqueChapters.unshift({ title: 'Beginning', startIndex: 0 });
    }

    return uniqueChapters;
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
            const properties = item.getAttribute("properties") || "";
            if (id && href) {
                manifest[id] = { href, mediaType, properties };
            }
        });

        // 4. Extract reading order (spine)
        const spine = [];
        const spineElement = getElementsByLocalName(opfDoc, "spine")[0];
        const spineTocId = spineElement ? spineElement.getAttribute("toc") : '';
        getElementsByLocalName(opfDoc, "itemref").forEach((itemref) => {
            const idref = itemref.getAttribute("idref");
            const linear = (itemref.getAttribute("linear") || "").toLowerCase();
            if (idref && linear !== "no") {
                spine.push(idref);
            }
        });

        // 5. Read HTML files sequentially, extract chapters and words
        const wordsArray = [];
        const documentInfos = [];
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

                    const cleanText = extractReadableText(doc, htmlStr);

                    const fileWords = splitWords(cleanText);
                    
                    if (fileWords.length > 0) {
                        documentInfos.push({
                            filePath,
                            doc,
                            startIndex: globalWordIndex,
                            wordCount: fileWords.length
                        });
                        wordsArray.push(...fileWords);
                        globalWordIndex += fileWords.length;
                    }
                }
            }
        }

        const tocEntries = [
            ...await extractNavTocEntries(zip, opfDir, manifest),
            ...await extractNcxTocEntries(zip, opfDir, manifest, spineTocId)
        ];
        const tocChapters = buildChaptersFromToc(tocEntries, documentInfos);
        const fallbackChapters = tocChapters.length > 0 ? tocChapters : buildChaptersFromHeadings(documentInfos);

        return {
            words: wordsArray,
            chapters: finalizeChapters(fallbackChapters, wordsArray.length)
        };

    } catch (error) {
        throw new Error("Error parsing EPUB: " + error.message);
    }
}
