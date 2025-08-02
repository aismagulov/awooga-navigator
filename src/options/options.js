const hostContainers = document.getElementById('hostContainers');

function renderHosts(regexMap) {
  hostContainers.innerHTML = '';
  // Group by host, but ensure all entries are rendered
  const grouped = {};
  regexMap.forEach(entry => {
    const host = entry.host || '';
    if (!grouped[host]) grouped[host] = [];
    grouped[host].push(entry);
  });
  Object.entries(grouped).forEach(([host, entries]) => {
    const hostDiv = document.createElement('div');
    hostDiv.className = 'host-container';
    hostDiv.innerHTML = `
      <div class="host-header" style="position:relative;">
        <span class="input-label">Host Name:</span>
        <input type="text" class="host-input monospace-input" value="${host}" placeholder="Host URL" />
        <button type="button" class="delete-host" title="Delete Host">X</button>
      </div>
      <div class="patterns-list"></div>
      <button type="button" class="add-pattern pattern-btn">Add Pattern</button>
    `;
    const patternsList = hostDiv.querySelector('.patterns-list');
    // Render all patterns for this host
    entries.forEach(entry => {
      console.log('Rendering entry:', entry);
      const escape = str => (str || '').replace(/"/g, '&quot;');
      const row = document.createElement('div');
      row.className = 'pattern-row';
      row.innerHTML = `
        <div class="input-label">Pattern:</div>
        <input type="text" class="monospace-input pattern-input" value="${escape(entry.key)}" placeholder="Pattern" />
        <div class="input-label">URL Template:</div>
        <input type="text" class="monospace-input url-input" value="${escape(entry.value)}" placeholder="URL Template" />
        <div class="input-label">Link Name:</div>
        <div style="display:flex;align-items:center;gap:4px;">
          <input type="text" class="name-input" value="${escape(entry.name)}" placeholder="Link Name" />
          <button type="button" class="emoji-picker-btn" title="Pick emoji">😀</button>
        </div>
        <button type="button" class="delete-pattern" title="Delete Pattern">X</button>
      `;
      // Emoji picker for name
      const nameInput = row.querySelector('.name-input');
      const emojiBtn = row.querySelector('.emoji-picker-btn');
      emojiBtn.onclick = () => {
        window.EmojiPicker.show({ anchor: emojiBtn, input: nameInput });
      };
      // Delete pattern row
      row.querySelector('.delete-pattern').onclick = () => {
        row.remove();
      };
      patternsList.appendChild(row);
    });
    // Add pattern row
    hostDiv.querySelector('.add-pattern').onclick = () => {
      const row = document.createElement('div');
      row.className = 'pattern-row';
      row.innerHTML = `
        <div class="input-label">Pattern:</div>
        <input type="text" class="pattern-input" placeholder="Pattern" />
        <div class="input-label">URL Template:</div>
        <input type="text" class="url-input" placeholder="URL Template" />
        <div class="input-label">Link Name:</div>
        <div style="display:flex;align-items:center;gap:4px;">
          <input type="text" class="name-input" placeholder="Link Name" />
          <button type="button" class="emoji-picker-btn" title="Pick emoji">😀</button>
        </div>
        <button type="button" class="delete-pattern">X</button>
      `;
      const nameInput = row.querySelector('.name-input');
      const emojiBtn = row.querySelector('.emoji-picker-btn');
      emojiBtn.onclick = () => {
        window.EmojiPicker.show({ anchor: emojiBtn, input: nameInput });
      };
      row.querySelector('.delete-pattern').onclick = () => {
        row.remove();
      };
      patternsList.appendChild(row);
    };
    // Delete host
    hostDiv.querySelector('.delete-host').onclick = () => {
      hostDiv.remove();
    };
    hostContainers.appendChild(hostDiv);
  });
}

// Add Host button
function addHost() {
  const hostDiv = document.createElement('div');
  hostDiv.className = 'host-container';
  hostDiv.innerHTML = `
    <div class="host-header" style="position:relative;">
      <input type="text" class="host-input" placeholder="Host URL" />
      <button type="button" class="delete-host" title="Delete Host">X</button>
    </div>
    <div class="patterns-list"></div>
    <button type="button" class="add-pattern pattern-btn">Add Pattern</button>
  `;
  hostDiv.querySelector('.add-pattern').onclick = () => {
    const row = document.createElement('div');
    row.className = 'pattern-row';
    row.innerHTML = `
      <div class="input-label">Pattern:</div>
      <input type="text" class="pattern-input" placeholder="Pattern" />
      <div class="input-label">URL Template:</div>
      <input type="text" class="url-input" placeholder="URL Template" />
      <div class="input-label">Link Name:</div>
      <input type="text" class="name-input" placeholder="Link Name" />
      <button type="button" class="emoji-picker-btn" title="Pick emoji">😀</button>
      <button type="button" class="delete-pattern">X</button>
    `;
    const nameInput = row.querySelector('.name-input');
    const emojiBtn = row.querySelector('.emoji-picker-btn');
    emojiBtn.onclick = () => {
      window.EmojiPicker.show({ anchor: emojiBtn, input: nameInput });
    };
    row.querySelector('.delete-pattern').onclick = () => {
      row.remove();
    };
    hostDiv.querySelector('.patterns-list').appendChild(row);
  };
  hostDiv.querySelector('.delete-host').onclick = () => {
    hostDiv.remove();
  };
  hostContainers.appendChild(hostDiv);
}

document.getElementById('addHost').onclick = addHost;

// On page load, read from storage and populate grouped UI
window.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('regexMap', (data) => {
    let arr = Array.isArray(data.regexMap) ? data.regexMap : [];
    renderHosts(arr);
  });
});

// Save button: collect grouped UI data and store as flat array
document.getElementById('save').onclick = () => {
  const arr = [];
  document.querySelectorAll('.host-container').forEach(hostDiv => {
    const host = hostDiv.querySelector('.host-input')?.value.trim() || '';
    hostDiv.querySelectorAll('.pattern-row').forEach(row => {
      const key = row.querySelector('.pattern-input')?.value.trim() || '';
      const value = row.querySelector('.url-input')?.value.trim() || '';
      const name = row.querySelector('.name-input')?.value.trim() || '';
      if (key) {
        // Validate key as regex with /pattern/flags format
        const regexFormat = /^\/(.*)\/([gimsuy]*)$/;
        const match = key.match(regexFormat);
        if (!match) {
          alert(`Invalid regex (must be in /pattern/flags format): ${key}`);
          return;
        }
        try {
          new RegExp(match[1], match[2]);
        } catch (e) {
          alert(`Invalid regex: ${key}`);
          return;
        }
        arr.push({ host, key, value, name });
      }
    });
  });
  chrome.storage.sync.set({ regexMap: arr }, () => {
    showMessage('Saved!');
  });
};

function showMessage(msg) {
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = msg;
  setTimeout(() => {
    messageDiv.textContent = '';
  }, 1500);
};

// Placeholder event handler for Import

// Import button: open file dialog and handle CSV import
document.getElementById('import').onclick = () => {
  document.getElementById('importFile').value = '';
  document.getElementById('importFile').click();
};

document.getElementById('importFile').addEventListener('change', function (e) {
  // Minimal RFC-compliant CSV line parser
  function parseCSVLine(line) {
    const result = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(field);
          field = '';
        } else {
          field += char;
        }
      }
    }
    result.push(field);
    return result;
  }
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    const text = event.target.result;
    const lines = text.split(/\r?\n/).filter(Boolean);
    // Validate columns in header
    if (lines.length > 0) {
      const headerCols = parseCSVLine(lines[0]);
      if (!headerCols || headerCols.length !== 4) {
        alert('Invalid CSV - incorrect number of columns');
        return;
      }
    }
    const importedArr = [];
    for (let i = 1; i < lines.length; i++) { // skip header
      const cols = parseCSVLine(lines[i]);
      if (!cols || cols.length !== 4) {
        alert('Invalid CSV - incorrect number of columns');
        return;
      }
      importedArr.push({
        host: cols[0],
        key: cols[1],
        value: cols[2],
        name: cols[3]
      });
    }
    if (importedArr.length === 0) {
      showMessage('No valid entries found in CSV.');
      return;
    }
    // Ask user: Replace or Append using custom modal
    showImportModal(
      // Replace
      () => {
        chrome.storage.sync.set({ regexMap: importedArr }, () => {
          showMessage('Imported (replaced)!');
          window.location.reload();
        });
      },
      // Append
      () => {
        chrome.storage.sync.get('regexMap', (data) => {
          const current = Array.isArray(data.regexMap) ? data.regexMap : [];
          // Only add imported entries that are not duplicates (host, key, value)
          const merged = current.slice();
          importedArr.forEach(newEntry => {
            const exists = current.some(existing =>
              existing.host === newEntry.host &&
              existing.key === newEntry.key &&
              existing.value === newEntry.value
            );
            if (!exists) merged.push(newEntry);
          });
          chrome.storage.sync.set({ regexMap: merged }, () => {
            showMessage('Imported (appended, no duplicates)!');
            window.location.reload();
          });
        });
      }
    );
  };
  reader.readAsText(file);
});

// Export button: download the array as CSV
document.getElementById('export').onclick = () => {
  chrome.storage.sync.get('regexMap', (data) => {
    const arr = Array.isArray(data.regexMap) ? data.regexMap : [];
    let csv = 'Host,Pattern,Url,Name\n';
    for (const entry of arr) {
      // Escape double quotes for CSV
      const safeHost = '"' + (entry.host || '').replace(/"/g, '""') + '"';
      const safeKey = '"' + (entry.key || '').replace(/"/g, '""') + '"';
      const safeValue = '"' + (entry.value || '').replace(/"/g, '""') + '"';
      const safeName = '"' + (entry.name || '').replace(/"/g, '""') + '"';
      csv += `${safeHost},${safeKey},${safeValue},${safeName}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'regex_map.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  });
};
