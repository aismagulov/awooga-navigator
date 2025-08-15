document.addEventListener('DOMContentLoaded', function() {
    const runButton = document.getElementById('run');
    const cleanButton = document.getElementById('clean');
    const optionsButton = document.getElementById('options');

    // Run button - trigger pattern matching in content script
    runButton.addEventListener('click', async function() {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.id) {
                // Send message to content script to run patterns
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'runPatterns' });
                
                if (response && response.success) {
                    console.log('Pattern matching completed successfully');
                    // Optional: provide visual feedback
                    runButton.textContent = 'Run ✓';
                    setTimeout(() => {
                        runButton.textContent = 'Run';
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error running patterns:', error);
            runButton.textContent = 'Error';
            setTimeout(() => {
                runButton.textContent = 'Run';
            }, 1000);
        }
    });

    // Clean button - remove all injected links
    cleanButton.addEventListener('click', async function() {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.id) {
                // Send message to content script to clean patterns
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'cleanPatterns' });
                
                if (response && response.success) {
                    console.log('Pattern cleaning completed successfully');
                    // Optional: provide visual feedback
                    cleanButton.textContent = 'Clean ✓';
                    setTimeout(() => {
                        cleanButton.textContent = 'Clean';
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error cleaning patterns:', error);
            cleanButton.textContent = 'Error';
            setTimeout(() => {
                cleanButton.textContent = 'Clean';
            }, 1000);
        }
    });

    // Options button - open the extension's options page
    optionsButton.addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
        window.close(); // Close the popup after opening options
    });
});
