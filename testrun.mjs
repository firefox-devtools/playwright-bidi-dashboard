import { startDate, msPerDay, decodeFilter, parseDate, formatDate, capitalize, countSuiteResults, disabledSuites, getLastDay } from './shared.mjs';

async function renderTestRun() {
  const searchParams = new URLSearchParams(location.search);

  if (!searchParams.has('browser') || !searchParams.has('date')) {
    return;
  }
  const browser = searchParams.get('browser');
  const dateString = searchParams.get('date');
  const date = parseDate(dateString);
  const day = (date - startDate) / msPerDay;

  const response = await fetch('./data.json');
  const data = await response.json();

  const lastDay = getLastDay(data);

  let enabledSuites;
  if (searchParams.has('filter')) {
    enabledSuites = [];
    decodeFilter(searchParams.get('filter'), (suite, enabled) => {
      if (enabled) {
        enabledSuites.push(suite);
      }
    });
  } else {
    enabledSuites = Object.keys(data).filter(suite => !disabledSuites.includes(suite));
  }

  const suitesCounts = enabledSuites.map(suite => {
    const counts = [0, 0, 0, 0];
    countSuiteResults(data[suite], day, browser, counts);
    const total = counts.reduce((a, b) => a + b);
    return {
      suite,
      passing: counts[0],
      skipping: counts[1],
      failing: counts[2] + counts[3],
      total,
      passingShare: counts[0] / total,
    };
  });
  suitesCounts.sort((a, b) => a.passingShare - b.passingShare);

  const table = document.getElementById('table');
  for (const suiteCounts of suitesCounts) {
    if (suiteCounts.total === 0) {
      continue;
    }
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

  const diffLinkEl = document.createElement('a');
  diffLinkEl.textContent = 'Diff';
  diffLinkEl.href = `${location.href.substring(0, location.href.lastIndexOf('/'))}/diff.html?browser=${browser}&date=${dateString}`;
  linksEl.appendChild(diffLinkEl);

  const prevDayLinkEl = document.createElement('a');
  if (day > 0) {
    const prevDayString = formatDate(new Date(date - msPerDay));
    prevDayLinkEl.textContent = prevDayString;
    prevDayLinkEl.href = `${location.origin}${location.pathname}?${modifiedSearchParams('date', prevDayString)}`;
    linksEl.appendChild(prevDayLinkEl);
  }

  const nextDayLinkEl = document.createElement('a');
  if (day < lastDay) {
    const nextDayString = formatDate(new Date(date + msPerDay));
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

function modifiedSearchParams(key, value) {
  const searchParams = new URLSearchParams(location.search);
  searchParams.set(key, value);
  return searchParams;
}

renderTestRun();
