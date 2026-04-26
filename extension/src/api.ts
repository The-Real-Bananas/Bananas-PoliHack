import type { DetectionResult, TextDetectionResult } from './types'

function getRealImageUrl(image: HTMLImageElement): string | null {
    // try these attributes in order - real URL is often hidden here
    const src = 
        image.getAttribute('data-src') ||        // lazy loading
        image.getAttribute('data-original') ||   // common lazy load lib
        image.getAttribute('data-lazy-src') ||   // wordpress lazy load
        image.getAttribute('data-url') ||
        image.src;

    if (!src) return null;
    if (src.startsWith('data:')) return null;    // still base64, skip
    if (src.startsWith('blob:')) return null;    // blob, skip
    if (!src.startsWith('http')) return null;    // not a real URL, skip

    return src;
}

export async function scanImages(images: HTMLImageElement[]): Promise<Map<HTMLImageElement, DetectionResult>> {
    const results = new Map<HTMLImageElement, DetectionResult>();

    for (const image of images) {
        const realUrl = getRealImageUrl(image);
        if (!realUrl) continue;

        await Promise.race([
            new Promise<void>((resolve) => {
                chrome.runtime.sendMessage(
                    { type: 'DETECT_IMAGE', url: realUrl },
                    (response) => {
                        if (response?.success) {
                            results.set(image, response.data);
                        } else {
                            console.warn('[AI Detector] Detection failed for:', realUrl, response?.error); 
                        }
                        resolve();
                    }
                );
            }),
            new Promise<void>((resolve) => setTimeout(resolve, 5000)) // 5s timeout
        ]);
    }

  return results;
}
        
export async function scanTexts(texts: HTMLElement[]): Promise<Map<HTMLElement, TextDetectionResult>> {
    const results = new Map<HTMLElement, TextDetectionResult>();
    
    for (const text of texts) {
        const textTrim = text.innerText.trim();
        if (!textTrim) continue;

        console.log('[AI Detector] Sending text (%d chars):', textTrim.length, textTrim.slice(0, 80));

        await Promise.race([
            new Promise<void>((resolve) => {
                chrome.runtime.sendMessage(
                    { type: 'DETECT_TEXT', text: textTrim },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn('[AI Detector] sendMessage error:', chrome.runtime.lastError.message);
                        } else if (response?.success) {
                            console.log('[AI Detector] Text result:', response.data);
                            results.set(text, response.data);
                        } else {
                            console.warn('[AI Detector] Detection failed:', response?.error ?? 'no response');
                        }
                        resolve();
                    }
                );
            }),
            // 30s — backend runs three HF pipelines and the first request also loads weights
            new Promise<void>((resolve) => setTimeout(() => {
                console.warn('[AI Detector] Text detection timed out');
                resolve();
            }, 30000)),
        ]);
    }
    return results;
}