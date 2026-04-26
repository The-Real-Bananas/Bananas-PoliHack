import { DEFAULT_SETTINGS } from "./types";

chrome.runtime.onInstalled.addListener(() => {
  console.log('[AI Detector] Extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SETTINGS':
      chrome.storage.local.get('displaySettings').then((data) => {
        sendResponse({ type: 'SENT_SETTINGS', settings: data.displaySettings ?? DEFAULT_SETTINGS });
      });
      break;
    case 'DETECT_IMAGE':
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
      break;
    case 'DETECT_TEXT':
      if (!message.text) {
        sendResponse({ success: false, error: 'No text provided' });
        return true;
      }
      fetch('http://localhost:8000/detect/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.text })
      })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => {
        console.error('[AI Detector] Fetch failed:', err.message);
        sendResponse({ success: false, error: err.message });
      });
      break;
  }
  return true;
});