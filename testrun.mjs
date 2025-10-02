import { decodeFilter, parseDate, formatDate, suiteNames } from './shared.mjs';

async function renderTestRun() {
  const searchParams = new URLSearchParams(location.search);

  if (!searchParams.has('browser') || !searchParams.has('date')) {
    return;
  }
  const browser = searchParams.get('browser');
  const dateString = searchParams.get('date');
  const date = parseDate(dateString);

  let enabledSuites;
  if (searchParams.has('filter')) {
    enabledSuites = [];
    decodeFilter(searchParams.get('filter'), (suite, enabled) => {
      if (enabled) {
        enabledSuites.push(suite);
      }
    });
  } else {
    enabledSuites = suiteNames;
  }

  const response = await fetch('./data.json');
  const entries = await response.json();
  const entry = entries.find(entry => entry.date === date);
  if (!entry) {
    return;
  }

  const allCounts = entry[`${browser}Counts`].bySuite;
  const suitesCounts = enabledSuites.filter(suite => allCounts[suite]).map(suite => {
    const counts = allCounts[suite];
    const total = counts.passing + counts.failing + counts.skipping;
    return {
      ...counts,
      suite,
      total,
      passingShare: counts.passing / total,
    };
  });
  suitesCounts.sort((a, b) => a.passingShare - b.passingShare);

  const table = document.getElementById('table');
  for (const suiteCounts of suitesCounts) {
    const suiteEl = document.createElement('div');
    suiteEl.className = 'suite';

    const resultEl = document.createElement('div');
    resultEl.className = 'result';
    suiteEl.appendChild(resultEl);

    const passingEl = document.createElement('div');
    passingEl.className = 'passing';
    passingEl.style.width = `${suiteCounts.passingShare * 100}%`;
    resultEl.appendChild(passingEl);

    const skippingEl = document.createElement('div');
    skippingEl.className = 'skipping';
    skippingEl.style.width = `${suiteCounts.skipping / suiteCounts.total * 100}%`
    resultEl.appendChild(skippingEl);

    resultEl.title = `${suiteCounts.passing} passing, ${suiteCounts.failing} failing, ${suiteCounts.skipping} skipped, ${suiteCounts.total} total`;
    suiteEl.append(suiteCounts.suite);

    table.appendChild(suiteEl);
  }

  document.getElementById('title').textContent = `${capitalize(browser)} test results on ${dateString}`;

  const linksEl = document.getElementById('links');

  const dashboardLinkEl = document.createElement('a');
  dashboardLinkEl.textContent = 'Dashboard';
  dashboardLinkEl.href = location.href.substring(0, location.href.lastIndexOf('/'));
  if (searchParams.has('filter')) {
    dashboardLinkEl.href += `?filter=${searchParams.get('filter')}`;
  }
  linksEl.appendChild(dashboardLinkEl);

  const prevDayLinkEl = document.createElement('a');
  const prevDay = date - 24 * 60 * 60 * 1000;
  if (entries.find(entry => entry.date === prevDay)) {
    const prevDayString = formatDate(new Date(prevDay));
    prevDayLinkEl.textContent = prevDayString;
    prevDayLinkEl.href = `${location.origin}${location.pathname}?${modifiedSearchParams('date', prevDayString)}`;
    linksEl.appendChild(prevDayLinkEl);
  }

  const nextDayLinkEl = document.createElement('a');
  const nextDay = date + 24 * 60 * 60 * 1000;
  if (entries.find(entry => entry.date === nextDay)) {
    const nextDayString = formatDate(new Date(nextDay));
    nextDayLinkEl.textContent = nextDayString;
    nextDayLinkEl.href = `${location.origin}${location.pathname}?${modifiedSearchParams('date', nextDayString)}`;
    linksEl.appendChild(nextDayLinkEl);
  }

  const otherBrowserLinkEl = document.createElement('a');
  const otherBrowser = browser === 'firefox' ? 'chrome' : 'firefox';
  otherBrowserLinkEl.textContent = capitalize(otherBrowser);
  otherBrowserLinkEl.href = `${location.origin}${location.pathname}?${modifiedSearchParams('browser', otherBrowser)}`;
  linksEl.appendChild(otherBrowserLinkEl);
}

function capitalize(s) {
  return s[0].toUpperCase() + s.substring(1);
}

function modifiedSearchParams(key, value) {
  const searchParams = new URLSearchParams(location.search);
  searchParams.set(key, value);
  return searchParams;
}

renderTestRun();
