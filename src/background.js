// This file contains the background script for the Chrome extension. It handles events and manages the extension's lifecycle.



chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
    chrome.contextMenus.create({
        id: 'navigate-to',
        title: 'Navigate to...',
        contexts: ['selection']
    });
});



// Handle context menu click: match regexes and log results
chrome.contextMenus.onClicked.addListener((info, tab) => {
    // Handle parent menu click (optional: can keep for logging)
    if (info.menuItemId === 'navigate-to' && info.selectionText) {
        chrome.storage.sync.get('regexMap', (data) => {
            const arr = Array.isArray(data.regexMap) ? data.regexMap : [];
            console.log('Highlighted text:', info.selectionText);
            for (const entry of arr) {
                const regexFormat = /^\/(.*)\/([gimsuy]*)$/;
                const match = entry.key.match(regexFormat);
                if (!match) continue;
                let re;
                let result = false;
                try {
                    re = new RegExp(match[1], match[2]);
                    result = re.test(info.selectionText);
                } catch (e) { result = false; }
                console.log('Regex:', entry.key, 'Match:', result);
            }
        });
    }
    // Handle submenu click: open matchedValue URL in new tab
    if (info.menuItemId.startsWith('navigate-to-link-')) {
        // Extract index from menuItemId
        const idx = parseInt(info.menuItemId.replace('navigate-to-link-', ''), 10);
        chrome.storage.sync.get('regexMap', (data) => {
            const arr = Array.isArray(data.regexMap) ? data.regexMap : [];
            const selectionText = info.selectionText ? info.selectionText.trim() : '';
            // Find the matching entry for this idx
            if (arr[idx]) {
                const entry = arr[idx];
                const regexFormat = /^\/(.*)\/([gimsuy]*)$/;
                const match = entry.key.match(regexFormat);
                if (match) {
                    try {
                        const re = new RegExp(match[1], match[2]);
                        const result = re.exec(selectionText);
                        if (result && result[1] !== undefined) {
                            let transformed = entry.value;
                            if (transformed.includes('%VAL%')) {
                                transformed = transformed.replace(/%VAL%/g, result[1]);
                            } else {
                                transformed += result[1];
                            }
                            chrome.tabs.create({ url: transformed });
                        }
                    } catch (e) { /* ignore */ }
                }
            }
        });
    }
});

// Listen for messages from popup.js (selection changed)
// Track submenu IDs for removal
let submenuIds = [];
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'selectionChanged') {
        console.log('Popup selection changed:', {
            url: message.url,
            text: message.text
        });
        // Remove all submenus from 'navigate-to'
        for (const id of submenuIds) {
            chrome.contextMenus.remove(id, () => {});
        }
        submenuIds = [];

        // If text is not empty, match regexes and collect values
        const selectedText = (message.text || '').trim();
        if (selectedText) {
            chrome.storage.sync.get('regexMap', (data) => {
                const arr = Array.isArray(data.regexMap) ? data.regexMap : [];
                // Instead of just matchedValues, track both value and original index
                const matchedEntries = [];
                arr.forEach((entry, idx) => {
                    const regexFormat = /^\/(.*)\/([gimsuy]*)$/;
                    const match = entry.key.match(regexFormat);
                    if (!match) return;
                    let re;
                    try {
                        re = new RegExp(match[1], match[2]);
                        const result = re.exec(selectedText);
                        if (result && result[1] !== undefined) {
                            let transformed = entry.value;
                            if (transformed.includes('%VAL%')) {
                                transformed = transformed.replace(/%VAL%/g, result[1]);
                            } else {
                                transformed += result[1];
                            }
                            matchedEntries.push({ url: transformed, idx });
                        }
                    } catch (e) { return; }
                });
                console.log('Transformed matched entries:', matchedEntries);
                // Create submenus for each matched entry using idx from regexMap
                matchedEntries.forEach(({ url, idx }) => {
                    const name = arr[idx] && arr[idx].name ? arr[idx].name : `Link ${idx}`;
                    const submenuId = `navigate-to-link-${idx}`;
                    chrome.contextMenus.create({
                        id: submenuId,
                        parentId: 'navigate-to',
                        title: name,
                        contexts: ['selection']
                    });
                    submenuIds.push(submenuId);
                });
            });
        }
    }
});
