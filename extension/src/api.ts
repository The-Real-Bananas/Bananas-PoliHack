import type { DetectionResult } from './types'

export async function scanImages(images: HTMLImageElement[]): Promise<Map<HTMLImageElement, DetectionResult>> {
    const results = new Map<HTMLImageElement, DetectionResult>();

    for (const image of images) {
        if (!image.src || image.src.startsWith('data:')) continue;

        await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
                { type: 'DETECT_IMAGE', url: image.src },
                (response) => {
                    if (response?.success) {
                        results.set(image, response.data);
                    }
                    resolve();
                }
            );
        });
    }

    return results;
}