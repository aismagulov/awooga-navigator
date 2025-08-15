const INJECTED_CLASS = 'awooga-navigator-injected';

function applyPattern(entry) {
    const pattern = entry.key;
    const urlTemplate = entry.value;
    console.log('Applying pattern:', { pattern, urlTemplate });
    // Validate pattern as /pattern/flags
    const regexFormat = /^\/(.*)\/([gimsuy]*)$/;
    const match = pattern.match(regexFormat);
    if (!match) return;
    let re;
    try {
        re = new RegExp(match[1], match[2]);
    } catch (e) { return; }

    // Collect fresh text nodes for this pattern
    const textNodes = [];
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    let node;
    while ((node = walker.nextNode())) {
        const parent = node.parentNode;
        if (!parent || parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE') continue;
        // Skip nodes that are already inside injected links
        if (parent.closest && parent.closest(`.${INJECTED_CLASS}`)) continue;
        textNodes.push(node);
    }

    // Process collected text nodes (working backwards to avoid index issues)
    for (let i = textNodes.length - 1; i >= 0; i--) {
        const node = textNodes[i];
        console.log('Processing text node:', node);
        
        // Re-check if node is still in DOM
        if (!node.parentNode || !document.body.contains(node)) continue;
        
        const text = node.nodeValue;
        const parent = node.parentNode;
        
        let result, lastIndex = 0;
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
            
            // Create URL from template
            let url = urlTemplate;
            if (result[1] !== undefined) {
                if (url.includes('*')) {
                    url = url.replace('*', result[1]);
                } else if (url.includes('%VAL%')) {
                    url = url.replace(/%VAL%/g, result[1]);
                } else {
                    url += result[1];
                }
            }
            
            // Create and append link
            const a = document.createElement('a');
            a.href = url;
            a.textContent = "[" + (entry.name || '🔗') + "]";
            a.classList.add(INJECTED_CLASS);
            a.target = '_blank';
            a.style.marginLeft = '2px';
            frag.appendChild(a);
            
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

function runPatternMatching() {
    chrome.storage.sync.get('regexMap', (data) => {
        const arr = Array.isArray(data.regexMap) ? data.regexMap : [];
        const pageUrl = window.location.href;
        
        // Apply each pattern, collecting fresh text nodes for each one
        arr.forEach(entry => {
            let proceed = false;
            if (!entry.host) {
                proceed = true;
            } else {
                // Validate host as regex in /pattern/flags format
                const regexFormat = /^\/(.*)\/([gimsuy]*)$/;
                const match = entry.host.match(regexFormat);
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
                applyPattern(entry);
            }
        });
    });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'runPatterns') {
        runPatternMatching();
        sendResponse({ success: true });
    } else if (request.action === 'cleanPatterns') {
        // Remove all injected links
        const injectedElements = document.querySelectorAll(`.${INJECTED_CLASS}`);
        injectedElements.forEach(element => element.remove());
        sendResponse({ success: true });
    }
});

// Run automatically on page load
runPatternMatching();