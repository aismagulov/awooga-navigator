const AWOOGA_ATTR = 'data-awooga-navigator-injected';

// document.addEventListener('selectionchange', () => {
//     const selectedText = window.getSelection().toString();
//     const pageUrl = window.location.href;
//     console.log('Selection changed:', {
//         url: pageUrl,
//         text: selectedText
//     });
//     // Send message to background script with selection info
//     chrome.runtime.sendMessage({
//         type: 'selectionChanged',
//         url: pageUrl,
//         text: selectedText
//     });
// });

function applyPattern(pattern, urlTemplate) {
    console.log('Applying pattern:', { pattern, urlTemplate });
    // Validate pattern as /pattern/flags
    const regexFormat = /^\/(.*)\/([gimsuy]*)$/;
    const match = pattern.match(regexFormat);
    if (!match) return;
    let re;
    try {
        re = new RegExp(match[1], match[2]);
    } catch (e) { return; }

    // Walk all text nodes in the body
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    let node;
    while ((node = walker.nextNode())) {
        let text = node.nodeValue;
        let result, lastIndex = 0, parent = node.parentNode;
        if (!parent || parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE') continue;
        // Don't process if previous sibling is already an injected link for this pattern and urlTemplate
        if (parent.previousSibling && parent.previousSibling.nodeType === 1 && parent.previousSibling.hasAttribute && parent.previousSibling.hasAttribute(AWOOGA_ATTR)) {
            continue;
        }
        let frag = document.createDocumentFragment();
        re.lastIndex = 0;
        let found = false;
        while ((result = re.exec(text)) !== null) {
            found = true;
            // Text before match
            if (result.index > lastIndex) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex, result.index)));
            }
            // Matched text
            const matchedText = result[0];
            frag.appendChild(document.createTextNode(matchedText));
            // Check if next sibling is already an injected link with the same href
            let url = urlTemplate;
            if (result[1] !== undefined) {
                if (url.includes('*')) {
                    url = url.replace('*', result[1]);
                } else {
                    url += result[1];
                }
            }
            console.log('Matched URL:', url, matchedText);
            let alreadyInjected = false;
            if (parent.nextSibling && parent.nextSibling.nodeType === 1 && parent.nextSibling.hasAttribute && parent.nextSibling.hasAttribute(AWOOGA_ATTR)) {
                if (parent.nextSibling.href === url) {
                    alreadyInjected = true;
                }
            }
            if (!alreadyInjected) {
                const a = document.createElement('a');
                a.href = url;
                a.textContent = '🔗';
                a.setAttribute(AWOOGA_ATTR, '1');
                a.target = '_blank';
                a.style.background = '#ffff99';
                a.style.marginLeft = '2px';
                frag.appendChild(a);
            }
            lastIndex = result.index + matchedText.length;
            if (!re.global) break;
        }
        if (found) {
            // Remaining text after last match
            if (lastIndex < text.length) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex)));
            }
            parent.replaceChild(frag, node);
        }
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    if (message.type === 'applyAwooga') {
        runAwooga();
    } else if (message.type === 'cleanupAwooga') {
        cleanupAwooga();
    }
});

function runAwooga() {
    cleanupAwooga();
    chrome.storage.sync.get('regexMap', (data) => {
        const arr = Array.isArray(data.regexMap) ? data.regexMap : [];
        const pageUrl = window.location.href;
        arr.forEach(entry => {
            const host = entry.host || '';
            let proceed = false;
            if (!host) {
                proceed = true;
            } else {
                // Validate host as regex in /pattern/flags format
                const regexFormat = /^\/(.*)\/([gimsuy]*)$/;
                const match = host.match(regexFormat);
                if (match) {
                    try {
                        const re = new RegExp(match[1], match[2]);
                        if (re.test(pageUrl)) {
                            proceed = true;
                        }
                    } catch (e) { /* invalid regex, do nothing */ }
                }
            }
            if (proceed) {
                applyPattern(entry.key, entry.value);
            }
        });
    });
}

function cleanupAwooga() {
    document.querySelectorAll('a[' + AWOOGA_ATTR + ']').forEach(a => a.remove());
}

runAwooga();