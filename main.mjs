import { encodeFilter, decodeFilter, suiteNames, formatDate, disabledSuites } from './shared.mjs';

let suiteCheckboxes = new Map();
let entries;
let chart;

const pf = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'percent',
  maximumFractionDigits: 2,
});

function formatPercentage(number) {
  return pf.format(number * 100);
}

function buildTooltip(label, counts) {
  return `
    <div style="padding: 10px; font-size: 18px;">
      <h3 style="margin: 0;">${label}</h3>
      <div>Total: ${counts.total}</div>
      <div>Passing: ${counts.passing} (${formatPercentage(
        counts.passing / counts.total,
      )})</div>
      <div>Skipping: ${counts.skipping}</div>
      <div>Failing: ${counts.failing}</div>
    </div>
  `;
}

function filteredCounts(counts) {
  let passing = 0;
  let failing = 0;
  let skipping = 0;
  for (const suite in counts?.bySuite ?? []) {
    if (suiteCheckboxes.get(suite).checked) {
      const suiteCounts = counts.bySuite[suite];
      passing += suiteCounts.passing;
      failing += suiteCounts.failing;
      skipping += suiteCounts.skipping;
    }
  }
  return { passing, failing, skipping, total: passing + failing + skipping };
}

function getFilteredCounts(entry) {
  const { firefoxCounts, chromeCounts } = entry;
  const firefoxFilteredCounts = filteredCounts(firefoxCounts);
  const chromeFilteredCounts = filteredCounts(chromeCounts);
  return { firefoxFilteredCounts, chromeFilteredCounts };
}

function createMainChart() {
  chart?.destroy();

  const chartData = [];

  for (const entry of entries) {
    const { firefoxFilteredCounts, chromeFilteredCounts } = getFilteredCounts(entry);
    chartData.push([
      new Date(entry.date),
      (firefoxFilteredCounts.passing / firefoxFilteredCounts.total) * 100,
      (chromeFilteredCounts.passing / chromeFilteredCounts.total) * 100,
      buildTooltip(
        'Firefox ' + new Date(entry.date).toLocaleDateString(),
        firefoxFilteredCounts,
      ),
      buildTooltip(
        'Chrome ' + new Date(entry.date).toLocaleDateString(),
        chromeFilteredCounts,
      ),
    ]);
  }

  const ctx = document.getElementById('chart');

  const getOrCreateTooltip = (chart) => {
    let tooltipEl = chart.canvas.parentNode.querySelector('div');

    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.style.background = 'rgb(0 0 0 / 70%)';
      tooltipEl.style.borderRadius = '3px';
      tooltipEl.style.color = 'white';
      tooltipEl.style.opacity = 1;
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.position = 'absolute';
      tooltipEl.style.transform = 'translate(-50%, 0)';
      tooltipEl.style.transition = 'all .1s ease';

      const table = document.createElement('table');
      table.style.margin = '0px';

      tooltipEl.appendChild(table);
      chart.canvas.parentNode.appendChild(tooltipEl);
    }

    return tooltipEl;
  };

  const externalTooltipHandler = (context) => {
    // Tooltip Element
    const { chart, tooltip } = context;
    const tooltipEl = getOrCreateTooltip(chart);

    // Hide if no tooltip
    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = 0;
      return;
    }

    // Set Text
    if (tooltip.body) {
      const dataPoints = tooltip.dataPoints;
      const dataPoint = dataPoints[0];
      const dataIndex = dataPoint.dataIndex;
      const datasetIndex = dataPoint.datasetIndex;
      tooltipEl.innerHTML = chartData[dataIndex][3 + datasetIndex];
    }

    const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;

    // Display, position, and set styles for font
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = positionX + tooltip.caretX + 'px';
    tooltipEl.style.top = Math.max(positionY + tooltip.caretY - 200, 0) + 'px';
    tooltipEl.style.font = tooltip.options.bodyFont.string;
    tooltipEl.style.padding =
      tooltip.options.padding + 'px ' + tooltip.options.padding + 'px';
  };

  if (innerWidth > 2000) {
    Chart.defaults.font.size = 38;
  }

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.map((item) => formatDate(item[0])),
      datasets: [
        {
          label: '% tests passed (Firefox)',
          data: chartData.map((item) => item[1]),
          borderWidth: 1,
        },
        {
          label: '% tests passed (Chrome)',
          data: chartData.map((item) => item[2]),
          borderWidth: 1,
        },
      ],
    },
    options: {
      onClick: (event, elements, chart) => {
        const browser = ['firefox', 'chrome'][elements[0].datasetIndex];
        const date = formatDate(chartData[elements[0].index][0]);
        let targetUrl = `${location.href.substring(0, location.href.lastIndexOf('/'))}/testrun.html?browser=${browser}&date=${date}`;
        const searchParams = new URLSearchParams(location.search);
        const filter = searchParams.get('filter');
        if (filter) {
          targetUrl += `&filter=${filter}`;
        }
        location.href = targetUrl;
      },
      plugins: {
        tooltip: {
          enabled: false,
          external: externalTooltipHandler,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          max: 100,
          ticks: {
            callback: function (value, index, ticks) {
              return value + '%';
            },
          },
        },
      },
    },
  });
}

function renderDashboard() {
  createMainChart();

  const { firefoxFilteredCounts, chromeFilteredCounts } = getFilteredCounts(entries[entries.length - 1]);

  document.querySelector('#firefox-failing').textContent =
    firefoxFilteredCounts.failing + firefoxFilteredCounts.skipping;

  document.querySelector('#chrome-failing').textContent =
    chromeFilteredCounts.failing + chromeFilteredCounts.skipping;
}

function filterUpdated() {
  renderDashboard();

  const url = new URL(location.href);
  url.searchParams.set('filter', encodeFilter(suite => suiteCheckboxes.get(suite).checked));
  history.replaceState(null, '', url.toString());
}

function renderConfig() {
  const configButtonEl = document.getElementById('config-button');
  const configEl = document.getElementById('config');
  const configToolbarEl = document.getElementById('config-toolbar');
  const results = entries[entries.length - 1];

  for (const suite of [...suiteCheckboxes.keys()].sort()) {
    const suiteEl = document.createElement('div');

    const resultEl = document.createElement('div');
    resultEl.className = 'suite-result';
    let resultTitles = [];
    const firefoxResultEl = document.createElement('div');
    firefoxResultEl.className = 'firefox';
    const firefoxResult = results.firefoxCounts?.bySuite[suite];
    if (firefoxResult) {
      const total = firefoxResult.passing + firefoxResult.failing + firefoxResult.skipping;
      if (total) {
        firefoxResultEl.style.width = `${firefoxResult.passing / total * 100}%`;
        resultTitles.push(`Firefox: ${firefoxResult.passing}/${total}`);
      }
    }
    const chromeResultEl = document.createElement('div');
    chromeResultEl.className = 'chrome';
    const chromeResult = results.chromeCounts?.bySuite[suite];
    if (chromeResult) {
      const total = chromeResult.passing + chromeResult.failing + chromeResult.skipping;
      if (total) {
        chromeResultEl.style.width = `${chromeResult.passing / total * 100}%`;
        resultTitles.push(`Chrome: ${chromeResult.passing}/${total}`);
      }
    }
    resultEl.title = resultTitles.join('\n');
    resultEl.appendChild(firefoxResultEl);
    resultEl.appendChild(chromeResultEl);

    const checkboxEl = document.createElement('input');
    checkboxEl.type = 'checkbox';
    checkboxEl.checked = firefoxResult && chromeResult && !disabledSuites.includes(suite);
    checkboxEl.onchange = filterUpdated;

    suiteEl.appendChild(checkboxEl);
    suiteEl.appendChild(resultEl);
    suiteEl.append(suite);

    configEl.appendChild(suiteEl);

    suiteCheckboxes.set(suite, checkboxEl);
  }

  configButtonEl.onclick = () => {
    const enable = configEl.style.display !== 'inline-block';
    configEl.style.display = enable ? 'inline-block' : 'none';
    configToolbarEl.style.display = enable ? 'inline-block' : 'none';
  };

  const toolbarButtons = configToolbarEl.querySelectorAll('button');
  toolbarButtons[0].onclick = () => {
    for (const suite of suiteCheckboxes.keys()) {
      suiteCheckboxes.get(suite).checked = true;
    }
    filterUpdated();
  }
  toolbarButtons[1].onclick = () => {
    for (const suite of suiteCheckboxes.keys()) {
      suiteCheckboxes.get(suite).checked = false;
    }
    filterUpdated();
  }
  toolbarButtons[2].onclick = () => {
    for (const suite of suiteCheckboxes.keys()) {
      suiteCheckboxes.get(suite).checked = !suiteCheckboxes.get(suite).checked;
    }
    filterUpdated();
  }
  toolbarButtons[3].onclick = () => {
    const results = entries[entries.length - 1];
    for (const suite of suiteCheckboxes.keys()) {
      const firefoxResult = results.firefoxCounts.bySuite[suite];
      const chromeResult = results.chromeCounts.bySuite[suite];
      if (
        !firefoxResult?.failing && !firefoxResult?.skipping &&
        !chromeResult?.failing && !chromeResult?.skipping
      ) {
        suiteCheckboxes.get(suite).checked = false;
      }
    }
    filterUpdated();
  }
}

async function main() {
  const response = await fetch('./data.json');
  entries = await response.json();

  for (const entry of entries) {
    for (const counts of [entry.firefoxCounts, entry.chromeCounts]) {
      for (const suite in counts?.bySuite ?? []) {
        suiteCheckboxes.set(suite, undefined);
        if (!suiteNames.includes(suite)) {
          console.warn(`Unknown suite ${suite}`);
        }
      }
    }
  }

  renderConfig();

  const searchParams = new URLSearchParams(location.search);
  if (searchParams.has('filter')) {
    decodeFilter(searchParams.get('filter'), (suite, value) => suiteCheckboxes.get(suite).checked = value);
  }

  renderDashboard();
}

main();
