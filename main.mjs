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

function formatDate(date) {
  return date.toISOString().slice(0, 'yyyy-mm-dd'.length);
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
  for (const suite in counts.bySuite) {
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
  url.searchParams.set('filter', encodeFilter());
  history.replaceState(null, '', url.toString());
}

function renderConfig() {
  const configButtonEl = document.getElementById('config-button');
  const configEl = document.getElementById('config');
  const configToolbarEl = document.getElementById('config-toolbar');
  const results = entries[entries.length - 1];

  for (const suite of [...suiteCheckboxes.keys()].sort()) {
    const suiteEl = document.createElement('div');

    const checkboxEl = document.createElement('input');
    checkboxEl.type = 'checkbox';
    checkboxEl.checked = true;
    checkboxEl.onchange = filterUpdated;

    const resultEl = document.createElement('div');
    resultEl.className = 'suite-result';
    let resultTitles = [];
    const firefoxResultEl = document.createElement('div');
    firefoxResultEl.className = 'firefox';
    const firefoxResult = results.firefoxCounts.bySuite[suite];
    if (firefoxResult) {
      const total = firefoxResult.passing + firefoxResult.failing + firefoxResult.skipping;
      if (total) {
        firefoxResultEl.style.width = `${firefoxResult.passing / total * 100}%`
        resultTitles.push(`Firefox: ${firefoxResult.passing}/${total}`);
      }
    }
    const chromeResultEl = document.createElement('div');
    chromeResultEl.className = 'chrome';
    const chromeResult = results.chromeCounts.bySuite[suite];
    if (chromeResult) {
      const total = chromeResult.passing + chromeResult.failing + chromeResult.skipping;
      if (total) {
        chromeResultEl.style.width = `${chromeResult.passing / total * 100}%`
        resultTitles.push(`Chrome: ${chromeResult.passing}/${total}`);
      }
    }
    resultEl.title = resultTitles.join('\n');
    resultEl.appendChild(firefoxResultEl);
    resultEl.appendChild(chromeResultEl);

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

function encodeFilter() {
  const encoded = new Uint8Array(Math.ceil(suiteNames.length / 8));
  suiteNames.forEach((suite, index) => {
    if (!suiteCheckboxes.get(suite).checked) {
      const byteIndex = Math.floor(index / 8);
      const bit = 1 << (7 - (index % 8));
      encoded[byteIndex] |= bit;
    }
  });
  return encoded.toBase64({ alphabet: "base64url", omitPadding: true });
}

function applyFilter(base64Encoded) {
  const encoded = Uint8Array.fromBase64(base64Encoded, { alphabet: "base64url" });
  suiteNames.forEach((suite, index) => {
    const byteIndex = Math.floor(index / 8);
    const bit = 1 << (7 - (index % 8));
    suiteCheckboxes.get(suite).checked = !(encoded[byteIndex] & bit);
  });
}

async function main() {
  const response = await fetch('./data.json');
  entries = await response.json();

  for (const entry of entries) {
    for (const counts of [entry.firefoxCounts, entry.chromeCounts]) {
      for (const suite in counts.bySuite) {
        suiteCheckboxes.set(suite, undefined);
        if (!suiteNames.includes(suite)) {
          console.warn(`Unknown suite ${suite}`);
        }
      }
    }
  }

  renderConfig();

  const url = new URL(location.href);
  if (url.searchParams.has('filter')) {
    applyFilter(url.searchParams.get('filter'));
  }

  renderDashboard();
}

main();

const suiteNames = [
  "library/beforeunload.spec.ts",
  "library/browser.spec.ts",
  "library/browsercontext-add-cookies.spec.ts",
  "library/browsercontext-add-init-script.spec.ts",
  "library/browsercontext-base-url.spec.ts",
  "library/browsercontext-basic.spec.ts",
  "library/browsercontext-clearcookies.spec.ts",
  "library/browsercontext-cookies-third-party.spec.ts",
  "library/browsercontext-cookies.spec.ts",
  "library/browsercontext-credentials.spec.ts",
  "library/browsercontext-csp.spec.ts",
  "library/browsercontext-device.spec.ts",
  "library/browsercontext-dsf.spec.ts",
  "library/browsercontext-events.spec.ts",
  "library/browsercontext-expose-function.spec.ts",
  "library/browsercontext-fetch-algorithms.spec.ts",
  "library/browsercontext-fetch-happy-eyeballs.spec.ts",
  "library/browsercontext-fetch.spec.ts",
  "library/browsercontext-har.spec.ts",
  "library/browsercontext-locale.spec.ts",
  "library/browsercontext-network-event.spec.ts",
  "library/browsercontext-page-event.spec.ts",
  "library/browsercontext-pages.spec.ts",
  "library/browsercontext-proxy.spec.ts",
  "library/browsercontext-reuse.spec.ts",
  "library/browsercontext-route.spec.ts",
  "library/browsercontext-service-worker-policy.spec.ts",
  "library/browsercontext-set-extra-http-headers.spec.ts",
  "library/browsercontext-storage-state.spec.ts",
  "library/browsercontext-strict.spec.ts",
  "library/browsercontext-timezone-id.spec.ts",
  "library/browsercontext-user-agent.spec.ts",
  "library/browsercontext-viewport-mobile.spec.ts",
  "library/browsercontext-viewport.spec.ts",
  "library/browsertype-basic.spec.ts",
  "library/browsertype-connect.spec.ts",
  "library/browsertype-launch-selenium.spec.ts",
  "library/browsertype-launch-server.spec.ts",
  "library/browsertype-launch.spec.ts",
  "library/capabilities.spec.ts",
  "library/channels.spec.ts",
  "library/chromium/bfcache.spec.ts",
  "library/chromium/chromium.spec.ts",
  "library/chromium/connect-over-cdp.spec.ts",
  "library/chromium/css-coverage.spec.ts",
  "library/chromium/disable-web-security.spec.ts",
  "library/chromium/extensions.spec.ts",
  "library/chromium/js-coverage.spec.ts",
  "library/chromium/launcher.spec.ts",
  "library/chromium/oopif.spec.ts",
  "library/chromium/session.spec.ts",
  "library/chromium/tracing.spec.ts",
  "library/client-certificates.spec.ts",
  "library/component-parser.spec.ts",
  "library/css-parser.spec.ts",
  "library/debug-controller.spec.ts",
  "library/defaultbrowsercontext-1.spec.ts",
  "library/defaultbrowsercontext-2.spec.ts",
  "library/download.spec.ts",
  "library/downloads-path.spec.ts",
  "library/emulation-focus.spec.ts",
  "library/events/add-listeners.spec.ts",
  "library/events/check-listener-leaks.spec.ts",
  "library/events/events-list.spec.ts",
  "library/events/listener-count.spec.ts",
  "library/events/listeners-side-effects.spec.ts",
  "library/events/listeners.spec.ts",
  "library/events/max-listeners.spec.ts",
  "library/events/method-names.spec.ts",
  "library/events/modify-in-emit.spec.ts",
  "library/events/num-args.spec.ts",
  "library/events/once.spec.ts",
  "library/events/prepend.spec.ts",
  "library/events/remove-all-listeners-wait.spec.ts",
  "library/events/remove-all-listeners.spec.ts",
  "library/events/remove-listeners.spec.ts",
  "library/events/set-max-listeners-side-effects.spec.ts",
  "library/events/special-event-names.spec.ts",
  "library/events/subclass.spec.ts",
  "library/events/symbols.spec.ts",
  "library/favicon.spec.ts",
  "library/fetch-proxy.spec.ts",
  "library/firefox/launcher.spec.ts",
  "library/geolocation.spec.ts",
  "library/global-fetch-cookie.spec.ts",
  "library/global-fetch.spec.ts",
  "library/har.spec.ts",
  "library/headful.spec.ts",
  "library/hit-target.spec.ts",
  "library/ignorehttpserrors.spec.ts",
  "library/launcher.spec.ts",
  "library/locator-dispatchevent-touch.spec.ts",
  "library/locator-generator.spec.ts",
  "library/logger.spec.ts",
  "library/modernizr.spec.ts",
  "library/multiclient.spec.ts",
  "library/page-clock.frozen.spec.ts",
  "library/page-clock.spec.ts",
  "library/page-close.spec.ts",
  "library/page-event-crash.spec.ts",
  "library/pdf.spec.ts",
  "library/permissions.spec.ts",
  "library/popup.spec.ts",
  "library/proxy-pattern.spec.ts",
  "library/proxy.spec.ts",
  "library/resource-timing.spec.ts",
  "library/role-utils.spec.ts",
  "library/route-web-socket.spec.ts",
  "library/screenshot.spec.ts",
  "library/selector-generator.spec.ts",
  "library/selectors-register.spec.ts",
  "library/shared-worker.spec.ts",
  "library/signals.spec.ts",
  "library/slowmo.spec.ts",
  "library/snapshotter.spec.ts",
  "library/tap.spec.ts",
  "library/trace-viewer.spec.ts",
  "library/tracing.spec.ts",
  "library/unit/clock.spec.ts",
  "library/unit/codegen.spec.ts",
  "library/unit/sequence.spec.ts",
  "library/unroute-behavior.spec.ts",
  "library/video.spec.ts",
  "library/web-socket.spec.ts",
  "page/elementhandle-bounding-box.spec.ts",
  "page/elementhandle-click.spec.ts",
  "page/elementhandle-content-frame.spec.ts",
  "page/elementhandle-convenience.spec.ts",
  "page/elementhandle-eval-on-selector.spec.ts",
  "page/elementhandle-misc.spec.ts",
  "page/elementhandle-owner-frame.spec.ts",
  "page/elementhandle-press.spec.ts",
  "page/elementhandle-query-selector.spec.ts",
  "page/elementhandle-screenshot.spec.ts",
  "page/elementhandle-scroll-into-view.spec.ts",
  "page/elementhandle-select-text.spec.ts",
  "page/elementhandle-type.spec.ts",
  "page/elementhandle-wait-for-element-state.spec.ts",
  "page/eval-on-selector-all.spec.ts",
  "page/eval-on-selector.spec.ts",
  "page/expect-boolean.spec.ts",
  "page/expect-matcher-result.spec.ts",
  "page/expect-misc.spec.ts",
  "page/expect-timeout.spec.ts",
  "page/expect-to-have-accessible.spec.ts",
  "page/expect-to-have-text.spec.ts",
  "page/expect-to-have-value.spec.ts",
  "page/frame-evaluate.spec.ts",
  "page/frame-frame-element.spec.ts",
  "page/frame-goto.spec.ts",
  "page/frame-hierarchy.spec.ts",
  "page/interception.spec.ts",
  "page/jshandle-as-element.spec.ts",
  "page/jshandle-evaluate.spec.ts",
  "page/jshandle-json-value.spec.ts",
  "page/jshandle-properties.spec.ts",
  "page/jshandle-to-string.spec.ts",
  "page/locator-click.spec.ts",
  "page/locator-convenience.spec.ts",
  "page/locator-element-handle.spec.ts",
  "page/locator-evaluate.spec.ts",
  "page/locator-frame.spec.ts",
  "page/locator-highlight.spec.ts",
  "page/locator-is-visible.spec.ts",
  "page/locator-list.spec.ts",
  "page/locator-misc-1.spec.ts",
  "page/locator-misc-2.spec.ts",
  "page/locator-query.spec.ts",
  "page/matchers.misc.spec.ts",
  "page/network-post-data.spec.ts",
  "page/page-accessibility.spec.ts",
  "page/page-add-init-script.spec.ts",
  "page/page-add-locator-handler.spec.ts",
  "page/page-add-script-tag.spec.ts",
  "page/page-add-style-tag.spec.ts",
  "page/page-aria-snapshot-ai.spec.ts",
  "page/page-aria-snapshot.spec.ts",
  "page/page-autowaiting-basic.spec.ts",
  "page/page-autowaiting-no-hang.spec.ts",
  "page/page-basic.spec.ts",
  "page/page-check.spec.ts",
  "page/page-click-during-navigation.spec.ts",
  "page/page-click-react.spec.ts",
  "page/page-click-scroll.spec.ts",
  "page/page-click-timeout-1.spec.ts",
  "page/page-click-timeout-2.spec.ts",
  "page/page-click-timeout-3.spec.ts",
  "page/page-click-timeout-4.spec.ts",
  "page/page-click.spec.ts",
  "page/page-dialog.spec.ts",
  "page/page-dispatchevent.spec.ts",
  "page/page-drag.spec.ts",
  "page/page-emulate-media.spec.ts",
  "page/page-evaluate-handle.spec.ts",
  "page/page-evaluate-no-stall.spec.ts",
  "page/page-evaluate.spec.ts",
  "page/page-event-console.spec.ts",
  "page/page-event-load.spec.ts",
  "page/page-event-network.spec.ts",
  "page/page-event-pageerror.spec.ts",
  "page/page-event-popup.spec.ts",
  "page/page-event-request.spec.ts",
  "page/page-expose-function.spec.ts",
  "page/page-filechooser.spec.ts",
  "page/page-fill.spec.ts",
  "page/page-focus.spec.ts",
  "page/page-goto.spec.ts",
  "page/page-history.spec.ts",
  "page/page-keyboard.spec.ts",
  "page/page-listeners.spec.ts",
  "page/page-mouse.spec.ts",
  "page/page-navigation.spec.ts",
  "page/page-network-idle.spec.ts",
  "page/page-network-request.spec.ts",
  "page/page-network-response.spec.ts",
  "page/page-network-sizes.spec.ts",
  "page/page-request-continue.spec.ts",
  "page/page-request-fallback.spec.ts",
  "page/page-request-fulfill.spec.ts",
  "page/page-request-gc.spec.ts",
  "page/page-request-intercept.spec.ts",
  "page/page-route.spec.ts",
  "page/page-screenshot.spec.ts",
  "page/page-select-option.spec.ts",
  "page/page-set-content.spec.ts",
  "page/page-set-extra-http-headers.spec.ts",
  "page/page-set-input-files.spec.ts",
  "page/page-strict.spec.ts",
  "page/page-wait-for-function.spec.ts",
  "page/page-wait-for-load-state.spec.ts",
  "page/page-wait-for-navigation.spec.ts",
  "page/page-wait-for-request.spec.ts",
  "page/page-wait-for-response.spec.ts",
  "page/page-wait-for-selector-1.spec.ts",
  "page/page-wait-for-selector-2.spec.ts",
  "page/page-wait-for-url.spec.ts",
  "page/queryselector.spec.ts",
  "page/retarget.spec.ts",
  "page/selectors-css.spec.ts",
  "page/selectors-frame.spec.ts",
  "page/selectors-get-by.spec.ts",
  "page/selectors-misc.spec.ts",
  "page/selectors-react.spec.ts",
  "page/selectors-register.spec.ts",
  "page/selectors-role.spec.ts",
  "page/selectors-text.spec.ts",
  "page/selectors-vue.spec.ts",
  "page/to-match-aria-snapshot.spec.ts",
  "page/wheel.spec.ts",
  "page/workers.spec.ts"
];
