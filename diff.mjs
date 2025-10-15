import { startDate, msPerDay, parseDate, capitalize } from './shared.mjs';

const RESULTS = ["passed", "skipped", "failed", "timedOut"];

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
  for (const suite in data) {
    for (const spec in data[suite]) {
      const results = data[suite][spec][browser];
      if (results[day - 1] === results[day]) {
        continue;
      }

      const testEl = document.createElement('div');
      testEl.className = 'test';

      const previousEl = document.createElement('div');
      previousEl.className = `previous result ${RESULTS[results[day - 1]]}`;
      previousEl.title = RESULTS[results[day - 1]];
      testEl.appendChild(previousEl);

      const currentEl = document.createElement('div');
      currentEl.className = `current result ${RESULTS[results[day]]}`;
      currentEl.title = RESULTS[results[day]];
      testEl.appendChild(currentEl);

      testEl.append(`${suite} > ${spec}`);

      table.appendChild(testEl);
    }
  }

  document.getElementById('title').textContent = `${capitalize(browser)} test result changes on ${dateString}`;
}

renderDiff();
