import { startDate, msPerDay, resultNames, resultClassnames, parseDate, formatDate, capitalize, labels } from './shared.mjs';

let data;

async function loadData() {
  const response = await fetch('./data.json');
  data = await response.json();
}

function getDaysBetween(startDateStr, endDateStr) {
  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);
  const startDay = (start - startDate) / msPerDay;
  const endDay = (end - startDate) / msPerDay;
  const days = [];
  for (let i = startDay; i <= endDay; i++) {
    days.push(i);
  }
  return days;
}

function normalizeStatus(status) {
  // timedOut (3) and failed (2) are considered the same
  if (status === 3) {
    return 2;
  }
  // skipped (1) and undefined/null are considered the same (ignored)
  if (status === 1 || status === undefined || status === null) {
    return undefined;
  }
  return status;
}

function countStatusChanges(specResults, browser, days) {
  if (!specResults[browser]) {
    return 0;
  }
  let previousStatus = undefined;
  let changeCount = 0;
  for (const day of days) {
    const currentStatus = normalizeStatus(specResults[browser][day]);
    if (previousStatus !== undefined && currentStatus !== undefined && previousStatus !== currentStatus) {
      changeCount++;
    }
    if (currentStatus !== undefined) {
      previousStatus = currentStatus;
    }
  }
  return changeCount;
}

function hasStatusChanged(specResults, browser, days, minChanges = 1) {
  return countStatusChanges(specResults, browser, days) >= minChanges;
}

function renderChanges() {
  const startDateInput = document.getElementById('startDate').value;
  const endDateInput = document.getElementById('endDate').value;
  const browser = document.getElementById('browser').value;
  const minChanges = parseInt(document.getElementById('minChanges').value) || 1;

  if (!startDateInput || !endDateInput) {
    return;
  }

  // Update URL search parameters
  const searchParams = new URLSearchParams();
  searchParams.set('startDate', startDateInput);
  searchParams.set('endDate', endDateInput);
  searchParams.set('browser', browser);
  if (minChanges !== 1) {
    searchParams.set('minChanges', minChanges);
  }
  window.history.replaceState({}, '', `?${searchParams.toString()}`);

  const days = getDaysBetween(startDateInput, endDateInput);
  if (days.length === 0) {
    return;
  }

  const table = document.getElementById('table');
  table.innerHTML = '';

  const changedTests = [];

  for (const suite in data.results) {
    for (const spec of Object.keys(data.results[suite]).sort()) {
      const specResults = data.results[suite][spec];
      if (hasStatusChanged(specResults, browser, days, minChanges)) {
        changedTests.push({ suite, spec, specResults });
      }
    }
  }

  for (const { suite, spec, specResults } of changedTests) {
    const specEl = document.createElement('div');
    specEl.className = 'test';

    // Add result boxes for each day
    for (const day of days) {
      const result = specResults[browser]?.[day];
      const resultDiv = document.createElement('div');
      if (typeof result === 'number') {
        resultDiv.className = `result ${resultClassnames[result]}`;
        resultDiv.title = `${formatDate(new Date(startDate + day * msPerDay))}: ${resultNames[result]}`;
      } else {
        resultDiv.className = 'result notrun';
        resultDiv.title = `${formatDate(new Date(startDate + day * msPerDay))}: not run`;
      }
      specEl.appendChild(resultDiv);
    }

    // Add test name
    const specText = `${suite} > ${spec}`;
    specEl.append(specText);

    // Add labels
    for (const [label, { color, suites }] of Object.entries(labels)) {
      if (suites.includes(suite)) {
        const labelEl = document.createElement('span');
        labelEl.className = 'label';
        labelEl.textContent = label;
        labelEl.style.backgroundColor = color;
        specEl.appendChild(labelEl);
      }
    }

    table.appendChild(specEl);
  }

  const title = `${capitalize(browser)} test result changes from ${startDateInput} to ${endDateInput}`;
  document.getElementById('title').textContent = title;
}

function initializeDateInputs() {
  // Set default dates to last 7 days
  const searchParams = new URLSearchParams(location.search);
  const endDateParam = searchParams.get('endDate');
  const startDateParam = searchParams.get('startDate');

  let endDate = new Date();
  let startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (endDateParam) {
    endDate = new Date(parseDate(endDateParam));
  }
  if (startDateParam) {
    startDate = new Date(parseDate(startDateParam));
  }

  document.getElementById('startDate').value = formatDate(startDate);
  document.getElementById('endDate').value = formatDate(endDate);

  if (searchParams.has('browser')) {
    document.getElementById('browser').value = searchParams.get('browser');
  }

  if (searchParams.has('minChanges')) {
    document.getElementById('minChanges').value = searchParams.get('minChanges');
  }
}

async function init() {
  await loadData();
  initializeDateInputs();
  document.getElementById('loadButton').addEventListener('click', renderChanges);
  
  // Also render on Enter key in date inputs
  document.getElementById('startDate').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') renderChanges();
  });
  document.getElementById('endDate').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') renderChanges();
  });

  // Also render on Enter key in minChanges input
  document.getElementById('minChanges').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') renderChanges();
  });

  // Initial render if parameters provided
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.has('startDate') && searchParams.has('endDate') && searchParams.has('browser')) {
    renderChanges();
  }
}

init();
