(() => {
  const sheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRB92QtjaK-NfAIT2FqmyUWVL8lTIX1YOE45mAY0PMjSyVNunJl42UFS59au5i7oOUu8tXRVEIn7K-0/pub?gid=0&single=true&output=csv';
  const rowsElement = document.getElementById('echo-days-rows');
  const status = document.getElementById('echo-days-status');

  // Quoted cells may contain commas, line breaks and escaped double quotes.
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const character = text[i];
      if (character === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = !quoted; }
      } else if (character === ',' && !quoted) {
        row.push(cell.trim()); cell = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        row.push(cell.trim()); rows.push(row); row = []; cell = '';
        if (character === '\r' && text[i + 1] === '\n') i++;
      } else {
        cell += character;
      }
    }
    if (quoted) throw new Error('Incomplete CSV');
    row.push(cell.trim()); rows.push(row);
    return rows.filter(cells => cells.some(Boolean));
  }

  function dateElement(value) {
    // Sheets uses UK dates; also accept ISO dates without browser date guessing.
    const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!uk && !iso) throw new Error('Unrecognised date');
    const [year, month, day] = uk ? [+uk[3], +uk[2], +uk[1]] : [+iso[1], +iso[2], +iso[3]];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error('Invalid date');
    }
    const time = document.createElement('time');
    time.dateTime = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    time.textContent = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    return time;
  }

  function messageRow(message) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.className = 'px-4 py-4 text-slate-700';
    cell.textContent = message;
    row.append(cell);
    rowsElement.replaceChildren(row);
  }

  async function loadDates() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(sheetURL, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Schedule unavailable');
      const [headers, ...entries] = parseCSV(await response.text());
      const columns = ['date', 'time', 'mentor'].map(name => headers?.findIndex(header => header.toLowerCase() === name));
      if (columns.some(index => index === undefined || index < 0)) throw new Error('Missing columns');
      const rows = entries.map(entry => {
        const values = columns.map(index => entry[index] || '');
        if (values.some(value => !value)) throw new Error('Incomplete session');
        const row = document.createElement('tr');
        const classes = ['font-semibold text-blue-950', 'font-semibold text-cyan-800', 'text-slate-700'];
        values.forEach((value, index) => {
          const cell = document.createElement('td');
          cell.className = `px-4 py-4 ${classes[index]}`;
          if (index === 0) cell.append(dateElement(value));
          else cell.textContent = value;
          row.append(cell);
        });
        return row;
      });
      if (rows.length) rowsElement.replaceChildren(...rows);
      else messageRow('No Echo days are currently listed. Join the WhatsApp group below to hear about new dates.');
      status.textContent = '';
    } catch {
      messageRow('The Echo days schedule could not be loaded.');
      const link = document.createElement('a');
      link.href = sheetURL.replace('/pub?', '/pubhtml?').replace('&output=csv', '');
      link.className = 'font-semibold text-blue-800 underline';
      link.textContent = 'View the Echo days schedule';
      status.replaceChildren(link, document.createTextNode(' or check the WhatsApp group below for updates.'));
    } finally {
      clearTimeout(timeout);
    }
  }

  loadDates();
})();
