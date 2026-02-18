import { startDate, msPerDay, resultClassnames, resultNames, decodeFilter, parseDate, formatDate, capitalize, countSuiteResults, disabledSuites, getLastDay, labels } from './shared.mjs';

async function renderTestRun() {
  const searchParams = new URLSearchParams(location.search);

  let urlChanged = false;
  if (!searchParams.has('browser')) {
    searchParams.set('browser', 'firefox');
    urlChanged = true;
  }
  if (!searchParams.has('date') && !searchParams.has('pr')) {
    searchParams.set('date', formatDate(new Date()));
    urlChanged = true;
  }
  if (urlChanged) {
    history.replaceState(null, '', `${location.pathname}?${searchParams}`);
  }

  const response = await fetch('./data.json');
  const data = await response.json();

  const browser = searchParams.get('browser');
  const prNumber = searchParams.get('pr');
  let dateString;
  let date;
  let day;
  let getResult;
  if (prNumber) {
    getResult = specResults => specResults?.pullRequests?.[browser]?.[prNumber];
  } else {
    dateString = searchParams.get('date');
    date = parseDate(dateString);
    day = (date - startDate) / msPerDay;
    getResult = specResults => specResults?.[browser]?.[day];
  }

  const lastDay = getLastDay(data.results);

  let enabledSuites;
  if (searchParams.has('filter')) {
    enabledSuites = [];
    decodeFilter(searchParams.get('filter'), (suite, enabled) => {
      if (enabled) {
        enabledSuites.push(suite);
      }
    });
  } else {
    enabledSuites = Object.keys(data.results).filter(suite => !disabledSuites.includes(suite));
  }

  const suitesCounts = enabledSuites.map(suite => {
    const counts = [0, 0, 0, 0];
    countSuiteResults(data.results[suite], getResult, counts);
    const total = counts.reduce((a, b) => a + b);
    return {
      suite,
      passing: counts[0],
      skipping: counts[1],
      failing: counts[2] + counts[3],
      total,
      passingShare: total ? counts[0] / total : 0,
    };
  });
  suitesCounts.sort((a, b) => a.passingShare - b.passingShare);

  const table = document.getElementById('table');
  for (const suiteCounts of suitesCounts) {
    if (suiteCounts.total === 0) {
      continue;
    }
    const suiteEl = document.createElement('details');
    suiteEl.className = 'suite';
    const summaryEl = document.createElement('summary');
    suiteEl.appendChild(summaryEl);

    const resultEl = document.createElement('div');
    resultEl.className = 'result';
    summaryEl.appendChild(resultEl);
    summaryEl.append(suiteCounts.suite);
    for (const [label, { color, suites }] of Object.entries(labels)) {
      if (suites.includes(suiteCounts.suite)) {
        const labelEl = document.createElement('span');
        labelEl.className = 'label';
        labelEl.textContent = label;
        labelEl.style.backgroundColor = color;
        summaryEl.appendChild(labelEl);
      }
    }

    const passingEl = document.createElement('div');
    passingEl.className = 'passing';
    passingEl.style.width = `${suiteCounts.passingShare * 100}%`;
    resultEl.appendChild(passingEl);

    const skippingEl = document.createElement('div');
    skippingEl.className = 'skipping';
    skippingEl.style.width = `${suiteCounts.skipping / suiteCounts.total * 100}%`
    resultEl.appendChild(skippingEl);

    resultEl.title = `${suiteCounts.passing} passing, ${suiteCounts.failing} failing, ${suiteCounts.skipping} skipped, ${suiteCounts.total} total`;

    const specResults = data.results[suiteCounts.suite];
    for (const spec of Object.keys(specResults).sort()) {
      const specEl = document.createElement('div');
      specEl.className = 'spec';
      suiteEl.appendChild(specEl);

      const resultEl = document.createElement('div');
      const result = getResult(specResults[spec]);
      resultEl.className = `result ${resultClassnames[result]}`;
      resultEl.title = resultNames[result];
      specEl.appendChild(resultEl);
      specEl.append(spec);
    }

    table.appendChild(suiteEl);
  }

  const title = `${capitalize(browser)} test results on ` + (prNumber ? `PR #${prNumber}` : dateString);
  document.getElementById('title').textContent = title;

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
  diffLinkEl.href = `${location.href.substring(0, location.href.lastIndexOf('/'))}/diff.html?${modifiedSearchParams('filter', undefined)}`;
  linksEl.appendChild(diffLinkEl);

  if (!prNumber) {
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
  }

  const otherBrowserLinkEl = document.createElement('a');
  const otherBrowser = browser === 'firefox' ? 'chrome' : 'firefox';
  otherBrowserLinkEl.textContent = capitalize(otherBrowser);
  otherBrowserLinkEl.href = `${location.origin}${location.pathname}?${modifiedSearchParams('browser', otherBrowser)}`;
  linksEl.appendChild(otherBrowserLinkEl);
}

function modifiedSearchParams(key, value) {
  const searchParams = new URLSearchParams(location.search);
  if (value !== undefined) {
    searchParams.set(key, value);
  } else {
    searchParams.delete(key);
  }
  return searchParams;
}

renderTestRun();
