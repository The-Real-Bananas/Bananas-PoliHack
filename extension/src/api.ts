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

        await Promise.race([
            new Promise<void>((resolve) => {
                chrome.runtime.sendMessage(
                    { type: 'DETECT_TEXT', text: textTrim },
                    (response) => {
                        if (response?.success) {
                            results.set(text, response.data);
                        } else {
                            console.warn('[AI Detector] Detection failed for:', textTrim, response?.error); 
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