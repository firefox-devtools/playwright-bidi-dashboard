import { capitalize } from './shared.mjs';

async function renderDiff() {
  const searchParams = new URLSearchParams(location.search);

  if (!searchParams.has('browser') || !searchParams.has('date')) {
    return;
  }
  const browser = searchParams.get('browser');
  const dateString = searchParams.get('date');

  const response = await fetch(`./diff/${dateString}-${browser}.json`);
  const entries = await response.json();

  const table = document.getElementById('table');
  for (const testPath in entries) {
    const testEl = document.createElement('div');
    testEl.className = 'test';

    const previousEl = document.createElement('div');
    previousEl.className = `previous result ${entries[testPath].previous}`;
    previousEl.title = entries[testPath].previous;
    testEl.appendChild(previousEl);

    const currentEl = document.createElement('div');
    currentEl.className = `current result ${entries[testPath].current}`;
    currentEl.title = entries[testPath].current;
    testEl.appendChild(currentEl);

    testEl.append(testPath);

    table.appendChild(testEl);
  }

  document.getElementById('title').textContent = `${capitalize(browser)} test result changes on ${dateString}`;
}

renderDiff();
