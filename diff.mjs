import { startDate, msPerDay, resultClassnames, parseDate, capitalize } from './shared.mjs';

async function renderDiff() {
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

  const table = document.getElementById('table');
  for (const suite in data.results) {
    for (const spec in data.results[suite]) {
      const results = data.results[suite][spec][browser];
      if (!results || results[day - 1] === results[day]) {
        continue;
      }

      const specEl = document.createElement('div');
      specEl.className = 'test';

      const previousEl = document.createElement('div');
      previousEl.className = `previous result ${resultClassnames[results[day - 1]]}`;
      previousEl.title = resultClassnames[results[day - 1]];
      specEl.appendChild(previousEl);

      const currentEl = document.createElement('div');
      currentEl.className = `current result ${resultClassnames[results[day]]}`;
      currentEl.title = resultClassnames[results[day]];
      specEl.appendChild(currentEl);

      specEl.append(`${suite} > ${spec}`);

      table.appendChild(specEl);
    }
  }

  document.getElementById('title').textContent = `${capitalize(browser)} test result changes on ${dateString}`;
}

renderDiff();
