import { startDate, msPerDay, encodeFilter, decodeFilter, suiteNames, formatDate, countSuiteResults, disabledSuites, getLastDay } from './shared.mjs';

let suiteCheckboxes = new Map();
let data;
let lastDay;
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
  const passing = counts[0];
  const skipping = counts[1];
  const failing = counts[2] + counts[3];
  const total = passing + skipping + failing;
  return `
    <div style="padding: 10px; font-size: 18px;">
      <h3 style="margin: 0;">${label}</h3>
      <div>Total: ${total}</div>
      <div>Passing: ${counts[0]} (${formatPercentage(
        passing / total,
      )})</div>
      <div>Skipping: ${skipping}</div>
      <div>Failing: ${failing}</div>
    </div>
  `;
}

function createMainChart() {
  chart?.destroy();

  const chartData = [];

  let firefoxCounts;
  let chromeCounts;
  for (let day = 0; day <= lastDay; day++) {
    firefoxCounts = [0, 0, 0, 0];
    chromeCounts = [0, 0, 0, 0];
    for (const suite in data.results) {
      if (suiteCheckboxes.get(suite).checked) {
        countSuiteResults(data.results[suite], specResults => specResults.firefox?.[day], firefoxCounts);
        countSuiteResults(data.results[suite], specResults => specResults.chrome?.[day], chromeCounts);
      }
    }

    const date = new Date(startDate + day * msPerDay);
    chartData.push([
      date,
      (firefoxCounts[0] / firefoxCounts.reduce((a,b)=>a+b)) * 100,
      (chromeCounts[0] / chromeCounts.reduce((a,b)=>a+b)) * 100,
      buildTooltip(
        'Firefox ' + date.toLocaleDateString(),
        firefoxCounts,
      ),
      buildTooltip(
        'Chrome ' + date.toLocaleDateString(),
        chromeCounts,
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

  return { firefoxCounts, chromeCounts };
}

function renderDashboard() {
  const { firefoxCounts, chromeCounts } = createMainChart();

  document.querySelector('#firefox-failing').textContent =
    firefoxCounts[1] + firefoxCounts[2] + firefoxCounts[3];

  document.querySelector('#chrome-failing').textContent =
    chromeCounts[1] + chromeCounts[2] + chromeCounts[3];
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

  for (const suite of [...suiteCheckboxes.keys()].sort()) {
    const firefoxCounts = [0, 0, 0, 0];
    countSuiteResults(data.results[suite], specResults => specResults.firefox?.[lastDay], firefoxCounts);
    const chromeCounts = [0, 0, 0, 0];
    countSuiteResults(data.results[suite], specResults => specResults.chrome?.[lastDay], chromeCounts);

    const suiteEl = document.createElement('div');

    const resultEl = document.createElement('div');
    resultEl.className = 'suite-result';
    let resultTitles = [];
    const firefoxResultEl = document.createElement('div');
    firefoxResultEl.className = 'firefox';
    const firefoxPassing = firefoxCounts[0];
    const firefoxTotal = firefoxCounts.reduce((a,b)=>a+b);
    if (firefoxTotal) {
      firefoxResultEl.style.width = `${firefoxPassing / firefoxTotal * 100}%`;
      resultTitles.push(`Firefox: ${firefoxPassing}/${firefoxTotal}`);
    }
    const chromeResultEl = document.createElement('div');
    chromeResultEl.className = 'chrome';
    const chromePassing = chromeCounts[0];
    const chromeTotal = chromeCounts.reduce((a,b)=>a+b);
    if (chromeTotal) {
      chromeResultEl.style.width = `${chromePassing / chromeTotal * 100}%`;
      resultTitles.push(`Chrome: ${chromePassing}/${chromeTotal}`);
    }
    resultEl.title = resultTitles.join('\n');
    resultEl.appendChild(firefoxResultEl);
    resultEl.appendChild(chromeResultEl);

    const checkboxEl = suiteCheckboxes.get(suite);

    suiteEl.appendChild(checkboxEl);
    suiteEl.appendChild(resultEl);
    suiteEl.append(suite);

    configEl.appendChild(suiteEl);
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
    for (const suite of suiteCheckboxes.keys()) {
      const firefoxCounts = [0, 0, 0, 0];
      countSuiteResults(data.results[suite], specResults => specResults.firefox?.[lastDay], firefoxCounts);
      const chromeCounts = [0, 0, 0, 0];
      countSuiteResults(data.results[suite], specResults => specResults.chrome?.[lastDay], chromeCounts);
      if (
        firefoxCounts[1] === 0 && firefoxCounts[2] === 0 && firefoxCounts[3] === 0 &&
        chromeCounts[1] === 0 && chromeCounts[2] === 0 && chromeCounts[3] === 0
      ) {
        suiteCheckboxes.get(suite).checked = false;
      }
    }
    filterUpdated();
  }
}

async function main() {
  const response = await fetch('./data.json');
  data = await response.json();
  lastDay = getLastDay(data.results);
  for (const suite of Object.keys(data.results)) {
    const checkboxEl = document.createElement('input');
    checkboxEl.type = 'checkbox';
    checkboxEl.checked = !disabledSuites.includes(suite);
    checkboxEl.onchange = filterUpdated;
    suiteCheckboxes.set(suite, checkboxEl);
    if (!suiteNames.includes(suite)) {
      console.warn(`Unknown suite ${suite}`);
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
