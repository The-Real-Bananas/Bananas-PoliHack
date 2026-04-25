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
      return true;
  }
});