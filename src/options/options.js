// TODO
// warning on identical links
// validate input fields
// fold unfold buttons

const hostContainers = document.getElementById('hostContainers');

window.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('regexMap', (data) => {
    let arr = Array.isArray(data.regexMap) ? data.regexMap : [];
    renderHosts(arr);
  });
});


function renderHosts(regexMap) {
  hostContainers.innerHTML = '';
  const grouped = {};
  regexMap.forEach(entry => {
    const host = entry.host || '';
    if (!grouped[host]) grouped[host] = [];
    grouped[host].push(entry);
  });

  Object.entries(grouped).forEach(([host, entries]) => {
    const hostDiv = document.createElement('div');
    hostDiv.className = 'host-container';
    hostDiv.innerHTML = getHostContainerHTML({ host });
    const patternsList = hostDiv.querySelector('.patterns-list');
    // Render all patterns for this host
    entries.forEach((entry, idx) => {
      console.log('Rendering entry:', entry);
      const escape = str => (str || '').replace(/"/g, '&quot;');
      const row = createPatternRow({
        key: entry.key,
        value: entry.value,
        name: entry.name,
        escape,
        patternNumber: idx + 1
      });
      patternsList.appendChild(row);
    });
    // Add pattern row
    hostDiv.querySelector('.add-pattern').onclick = () => {
      const row = createPatternRow();
      patternsList.appendChild(row);
    };
    // Delete host
    hostDiv.querySelector('.delete-host').onclick = () => {
      hostDiv.remove();
    };
    hostContainers.appendChild(hostDiv);
  });
}

document.getElementById('addHost').onclick = () => {
  const hostDiv = document.createElement('div');
  hostDiv.className = 'host-container';
  hostDiv.innerHTML = getHostContainerHTML();

  hostDiv.querySelector('.add-pattern').onclick = () => {
    const row = createPatternRow();
    hostDiv.querySelector('.patterns-list').appendChild(row);
  };
  hostDiv.querySelector('.delete-host').onclick = () => {
    hostDiv.remove();
  };
  hostContainers.appendChild(hostDiv);
}


document.getElementById('save').onclick = () => {
  const arr = [];
  document.querySelectorAll('.host-container').forEach(hostDiv => {
    console.log('Saving host container:', hostDiv);
    const host = hostDiv.querySelector('.host-input')?.value.trim() || '';
    if (!isValidRegex(host)) {
      alert(`The Host URL must be a valid regex: ${host}`);
      return;
    }
    hostDiv.querySelectorAll('.pattern-row').forEach(row => {
      const key = row.querySelector('.pattern-input')?.value.trim() || '';
      const value = row.querySelector('.url-input')?.value.trim() || '';
      const name = row.querySelector('.name-input')?.value.trim() || '';
      if (key) {
        if (!isValidRegex(key)) {
          alert(`Invalid regex (must be in /pattern/flags format): ${key}`);
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

// Import button: open file dialog and handle CSV import
document.getElementById('import').onclick = () => {
  document.getElementById('importFile').value = '';
  document.getElementById('importFile').click();
};

document.getElementById('importFile').addEventListener('change', function (e) {
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

function getHostContainerHTML(opts = {}) {
  const host = opts.host !== undefined ? opts.host : '';
  return `
    <div class="host-header">
      <span class="host-label">Host Name</span>
      <input type="text" class="host-input monospace-input" value="${host}" placeholder="Host URL" />
      <button type="button" class="delete-host" title="Delete Host">X</button>
    </div>
    <div class="patterns-list"></div>
    <button type="button" class="add-pattern pattern-btn">Add Pattern</button>
  `;
}

// Helper to create a pattern row (avoids duplication)
function createPatternRow(opts = {}) {
  const escape = opts.escape || (str => str || '');
  const key = opts.key ? escape(opts.key) : '';
  const value = opts.value ? escape(opts.value) : '';
  const name = opts.name ? escape(opts.name) : '';
  const row = document.createElement('div');
  row.className = 'pattern-row';
  const patternLabel = opts.patternNumber ? `Pattern ${opts.patternNumber}` : 'Pattern';
  row.innerHTML = `
    <div class="pattern-details-container">
      <span class="input-label">${patternLabel}</span>
      <input type="text" class="monospace-input pattern-input" value="${key}" placeholder="Pattern" />
    </div>
    <div class="link-details-container">
      <span class="input-label">URL Template</span>
      <input type="text" class="monospace-input url-input" value="${value}" placeholder="URL Template" />
      <div class="input-label">Link Name</div>
      <div class="link-name-container">
        <input type="text" class="name-input" value="${name}" placeholder="Link Name" />
        <button type="button" class="emoji-picker-btn" title="Pick emoji">😀</button>
      </div>
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
  return row;
}

function isValidRegex(str) {
  const regexFormat = /^\/(.*)\/([gimsuy]*)$/;
  const match = str.match(regexFormat);
  if (!match) return false;
  try {
    new RegExp(match[1], match[2]);
    return true;
  } catch (e) {
    return false;
  }
}

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