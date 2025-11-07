import { startDate, msPerDay, resultNames, resultClassnames, parseDate, capitalize } from './shared.mjs';

async function renderDiff() {
  const searchParams = new URLSearchParams(location.search);

  if (!searchParams.has('browser') || (!searchParams.has('date') && !searchParams.has('pr'))) {
    return;
  }

  const response = await fetch('./data.json');
  const data = await response.json();

  const browser = searchParams.get('browser');
  const prNumber = searchParams.get('pr');
  const dateString = prNumber ? data.pullRequests[prNumber][browser].date.substring(0, 10) : searchParams.get('date');
  const date = parseDate(dateString);
  const day = (date - startDate) / msPerDay;
  function getCurrentResult(specResults) {
    if (prNumber) {
      return specResults?.pullRequests?.[browser]?.[prNumber];
    } else {
      return specResults?.[browser]?.[day];
    }
  }
  function getPreviousResult(specResults) {
    if (prNumber) {
      return specResults?.[browser]?.[day];
    } else {
      return specResults?.[browser]?.[day - 1];
    }
  }

  const table = document.getElementById('table');
  for (const suite in data.results) {
    for (const spec of Object.keys(data.results[suite]).sort()) {
      const specResults = data.results[suite][spec];
      const currentResult = getCurrentResult(specResults);
      const previousResult = getPreviousResult(specResults);
      if (currentResult === previousResult) {
        continue;
      }

      const specEl = document.createElement('div');
      specEl.className = 'test';

      const previousEl = document.createElement('div');
      previousEl.className = `previous result ${resultClassnames[previousResult]}`;
      previousEl.title = resultNames[previousResult];
      specEl.appendChild(previousEl);

      const currentEl = document.createElement('div');
      currentEl.className = `current result ${resultClassnames[currentResult]}`;
      currentEl.title = resultNames[currentResult];
      specEl.appendChild(currentEl);

      specEl.append(`${suite} > ${spec}`);

      table.appendChild(specEl);
    }
  }

  const title = `${capitalize(browser)} test result changes on ` + (prNumber ? `PR #${prNumber}` : dateString);
  document.getElementById('title').textContent = title;
}

renderDiff();
