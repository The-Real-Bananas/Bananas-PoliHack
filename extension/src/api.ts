import type { DetectionResult } from './types'

export async function scanImage(images: HTMLImageElement[]): Promise<Map<HTMLImageElement, DetectionResult>> {
    const results = new Map<HTMLImageElement, DetectionResult>();

    for (const image of images) {
        if (!image.src) {
            continue;
        }

        try{
            const res = await fetch('http://localhost:8000/detect/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: image.src })
            })

        const result: DetectionResult = await res.json()
        results.set(image, result)

        //results.set(image, { score: 99, source: 'mock' });
        } catch(e) {
            console.warn('Failed to scan image:', image.src, e)
        }

    }

  return results;
}