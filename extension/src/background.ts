// Service worker for AI Content Detector
chrome.runtime.onInstalled.addListener(() => {
  console.log('[AI Detector] Extension installed');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'DETECT_IMAGE') {
        fetch('http://localhost:8000/detect/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: message.url })
        })
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));

        return true; // keep channel open for async response
    }
    // added for vector of images processing
    if (message.type === 'DETECT_IMAGES_BATCH') {
        fetch('http://localhost:8000/detect/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: message.urls })
        })
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));

    return true;
    }
});