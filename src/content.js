document.addEventListener('selectionchange', () => {
    const selectedText = window.getSelection().toString();
    const pageUrl = window.location.href;
    console.log('Selection changed:', {
        url: pageUrl,
        text: selectedText
    });
    // Send message to background script with selection info
    chrome.runtime.sendMessage({
        type: 'selectionChanged',
        url: pageUrl,
        text: selectedText
    });
});