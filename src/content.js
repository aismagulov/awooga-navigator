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
        if (parent.previousSibling && parent.previousSibling.nodeType === 1 && parent.previousSibling.hasAttribute && parent.previousSibling.hasAttribute('data-awooga-injected')) {
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
                } else if (url.includes('%VAL%')) {
                    url = url.replace(/%VAL%/g, result[1]);
                } else {
                    url += result[1];
                }
            }
            let alreadyInjected = false;
            if (parent.nextSibling && parent.nextSibling.nodeType === 1 && parent.nextSibling.hasAttribute && parent.nextSibling.hasAttribute('data-awooga-injected')) {
                if (parent.nextSibling.href === url) {
                    alreadyInjected = true;
                }
            }
            if (!alreadyInjected) {
                const a = document.createElement('a');
                a.href = url;
                a.textContent = (entry.name || '🔗') + '↗️';
                a.setAttribute('data-awooga-injected', '1');
                a.target = '_blank';
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

chrome.storage.sync.get('regexMap', (data) => {
    const arr = Array.isArray(data.regexMap) ? data.regexMap : [];
    const pageUrl = window.location.href;
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