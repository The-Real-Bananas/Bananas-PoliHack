// import type { DetectionResult } from './types'
//
// export async function scanImages(images: HTMLImageElement[]): Promise<Map<HTMLImageElement, DetectionResult>> {
//     const results = new Map<HTMLImageElement, DetectionResult>();
//
//     for (const image of images) {
//         if (!image.src || image.src.startsWith('data:')) continue;
//
//         await new Promise<void>((resolve) => {
//             chrome.runtime.sendMessage(
//                 { type: 'DETECT_IMAGE', url: image.src },
//                 (response) => {
//                     if (response?.success) {
//                         results.set(image, response.data);
//                     }
//                     resolve();
//                 }
//             );
//         });
//     }
//
//     return results;
// }

import type { DetectionResult } from './types'

export async function scanImages(images: HTMLImageElement[]): Promise<Map<HTMLImageElement, DetectionResult>> {
    const results = new Map<HTMLImageElement, DetectionResult>();

    const validImages = images.filter(img => img.src && !img.src.startsWith('data:'));
    const urls = validImages.map(img => img.src);

    if (urls.length === 0) return results;

    await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
            { type: 'DETECT_IMAGES_BATCH', urls },
            (response) => {
                if (response?.success) {
                    validImages.forEach((image, i) => {
                        results.set(image, response.data[i]);
                    });
                }
                resolve();
            }
        );
    });

    return results;
}