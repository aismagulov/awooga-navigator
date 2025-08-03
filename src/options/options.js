// TODO
// fold unfold buttons
const FOLD = "▼";
const UNFOLD = "▶";
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
    initHostContainer(hostDiv, entries);

    hostContainers.appendChild(hostDiv);
  });
}

document.getElementById('addHost').onclick = () => {
  const hostDiv = document.createElement('div');
  hostDiv.className = 'host-container';
  hostDiv.innerHTML = getHostContainerHTML();
  initHostContainer(hostDiv, []);
  hostContainers.appendChild(hostDiv);
}

function initHostContainer(hostDiv, entries) {

    const patternsList = hostDiv.querySelector('.patterns-list');
    const foldBtn = hostDiv.querySelector('.fold-btn');
    const warningDiv = hostDiv.querySelector('.duplicate-link-warning');
console.log("foldBtn", hostDiv.querySelector('.fold-btn'));
    // Elements to hide/show when folding
    const foldTargets = [patternsList, warningDiv, hostDiv.querySelector('.add-pattern.pattern-btn')];
    foldBtn.onclick = () => {
      const folded = foldBtn.textContent === UNFOLD;
      if (folded) {
        foldTargets.forEach(el => { if (el) el.style.display = ''; });
        foldBtn.textContent = FOLD;
      } else {
        foldTargets.forEach(el => { if (el) el.style.display = 'none'; });
        foldBtn.textContent = UNFOLD;
      }
    };

    // Render all patterns for this host
    const patternRows = [];
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
      patternRows.push(row);
    });

    // Add pattern row
    hostDiv.querySelector('.add-pattern').onclick = () => {
      const row = createPatternRow({ patternNumber: patternsList.children.length + 1 });
      patternsList.appendChild(row);
      patternRows.push(row);
      updateDuplicateWarning();
      // Add live update for new row
      const nameInput = row.querySelector('.name-input');
      nameInput.addEventListener('input', updateDuplicateWarning);
    };
    // Delete host
    hostDiv.querySelector('.delete-host').onclick = () => {
      hostDiv.remove();
    };

    // Add live update for all pattern name inputs
    patternRows.forEach((row) => {
      const nameInput = row.querySelector('.name-input');
      nameInput.addEventListener('input', updateDuplicateWarning);
    });

    // Function to update duplicate warning
    function updateDuplicateWarning() {
      // Get all link names and their pattern indices
      const names = [];
      patternsList.querySelectorAll('.pattern-row').forEach((row, idx) => {
        const name = row.querySelector('.name-input')?.value.trim() || '';
        names.push({ name, idx: idx + 1 });
      });
      // Find duplicates
      const nameMap = {};
      names.forEach(({ name, idx }) => {
        if (!name) return;
        if (!nameMap[name]) nameMap[name] = [];
        nameMap[name].push(idx);
      });
      const dups = Object.values(nameMap).filter(arr => arr.length > 1);
      if (dups.length > 0) {
        const msg = dups.map(arr => `Pattern ${arr.join(' and ')} have identical link names`).join('. ');
        warningDiv.textContent = msg;
        warningDiv.style.display = '';
      } else {
        warningDiv.textContent = '';
        warningDiv.style.display = 'none';
      }
    }

    updateDuplicateWarning();
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
      <span class="host-label">Host</span>
      <input type="text" class="host-input monospace-input" value="${host}" placeholder="Host URL" />
      <div class="duplicate-link-warning" style="display: none;"></div>
      <button type="button" class="top-right-btn delete-host" title="Delete Host">X</button>
      <button type="button" class="top-right-btn fold-btn" title="Fold Host">▼</button>
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