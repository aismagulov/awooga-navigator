const table = document.getElementById('regexTable').getElementsByTagName('tbody')[0];

function addRow(host = '', key = '', value = '', name = '') {
  const row = table.insertRow();
  let cell1 = row.insertCell(0);
  let cell2 = row.insertCell(1);
  let cell3 = row.insertCell(2);
  let cell4 = row.insertCell(3);
  let cell5 = row.insertCell(4);
  cell1.innerHTML = `<input type="text" value="${host.replace(/"/g, '&quot;')}" />`;
  cell2.innerHTML = `<input type="text" value="${key.replace(/"/g, '&quot;')}" />`;
  cell3.innerHTML = `<input type="text" value="${value.replace(/"/g, '&quot;')}" />`;
  cell4.innerHTML = `<input type="text" value="${name.replace(/"/g, '&quot;')}" placeholder="Submenu name" />`;
  cell5.innerHTML = '<button class="delete-row">X</button>';
  // Add delete functionality
  const deleteBtn = cell5.querySelector('.delete-row');
  deleteBtn.onclick = () => {
    row.remove();
  };
}

document.getElementById('addRow').onclick = () => {
  addRow();
};

// On page load, read from storage and populate table (array of {key, value})
window.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('regexMap', (data) => {
    let arr = Array.isArray(data.regexMap) ? data.regexMap : [];
    // Sort by key, then by value
    arr = arr.slice().sort((a, b) => {
      if (a.key === b.key) {
        return (a.value || '').localeCompare(b.value || '');
      }
      return (a.key || '').localeCompare(b.key || '');
    });
    // Remove all rows first
    while (table.rows.length > 0) table.deleteRow(0);
    if (arr.length === 0) {
      addRow();
    } else {
      for (const entry of arr) {
        addRow(entry.host || '', entry.key, entry.value, entry.name || '');
      }
    }
  });
});


// Save button: collect table data and store as array of {key, value} in chrome.storage
document.getElementById('save').onclick = () => {
  const arr = [];
  for (const row of table.rows) {
    const host = row.cells[0].querySelector('input').value.trim();
    const key = row.cells[1].querySelector('input').value.trim();
    const value = row.cells[2].querySelector('input').value.trim();
    const name = row.cells[3].querySelector('input').value.trim();
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
  }
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
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    const text = event.target.result;
    const lines = text.split(/\r?\n/).filter(Boolean);
    // Validate columns in header
    if (lines.length > 0) {
      const headerCols = lines[0].split(',');
      if (headerCols.length !== 2) {
        alert('Invalid CSV - incorrect number of columns');
        return;
      }
    }
    const importedArr = [];
    for (let i = 1; i < lines.length; i++) { // skip header
      // Count columns by splitting on commas not inside quotes
      const cols = lines[i].match(/("[^"]*"|[^,]+)/g);
      if (!cols || cols.length !== 2) {
        alert('Invalid CSV - incorrect number of columns');
        return;
      }
      const match = lines[i].match(/^"((?:[^"]|"")*)","((?:[^"]|"")*)"$/);
      if (match) {
        const key = match[1].replace(/""/g, '"');
        const value = match[2].replace(/""/g, '"');
        importedArr.push({ key, value });
      }
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
          const merged = current.concat(importedArr);
          chrome.storage.sync.set({ regexMap: merged }, () => {
            showMessage('Imported (appended)!');
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
    let csv = 'Pattern,Url\n';
    for (const entry of arr) {
      // Escape double quotes and commas in CSV
      const safeKey = '"' + (entry.key || '').replace(/"/g, '""') + '"';
      const safeValue = '"' + (entry.value || '').replace(/"/g, '""') + '"';
      csv += `${safeKey},${safeValue}\n`;
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
