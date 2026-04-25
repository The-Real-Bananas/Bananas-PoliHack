// Service worker for AI Content Detector
chrome.runtime.onInstalled.addListener(() => {
  console.log('[AI Detector] Extension installed');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'DETECT_IMAGE') {

        // safety net - should have been caught in content script
        if (!message.url || message.url.startsWith('data:') || message.url.startsWith('blob:')) {
            sendResponse({ success: false, error: 'Invalid URL' });
            return true;
        }

        fetch('http://localhost:8000/detect/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: message.url })
        })
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(err => {
            console.error('[AI Detector] Fetch failed:', err.message);
            sendResponse({ success: false, error: err.message });
        });

        return true;
    }
});