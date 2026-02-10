const fs = require("fs");
const AdmZip = require("adm-zip");

const RESULTS = ["passed", "skipped", "failed", "timedOut"];

function processArtifacts() {
  const data = JSON.parse(fs.readFileSync("../gh-pages/data.json"));
  if (!data.results) {
    data.results = {};
  }
  const results = data.results;

  let lastDay = 0;
  fs.readdirSync("./data").filter(parseFilename).forEach(filename => {
    const { browser, day } = parseFilename(filename);
    lastDay = Math.max(lastDay, day);
    if (Object.values(results).some(suite => Object.values(suite).some(spec => !!spec[browser]?.[day]))) {
      console.log(`${filename} already processed - skipping`);
      return;
    }

    console.log(`Process ${filename}`);
    const report = readArtifact(`./data/${filename}`);
    for (const suite of report.suites) {
      if (!results[suite.title]) {
        results[suite.title] = {};
      }
      forEachSpec(suite, (spec, path) => {
        const specPath = [...path, spec.title].join(" > ");
        if (!spec.tests[0].results[0]) {
          return;
        }
        const result = spec.tests[0].results[0].status;
        if (!results[suite.title][specPath]) {
          results[suite.title][specPath] = {};
        }
        if (!results[suite.title][specPath][browser]) {
          results[suite.title][specPath][browser] = [];
        }
        results[suite.title][specPath][browser][day] = RESULTS.indexOf(result);
      });
    }
  });

  if (!data.pullRequests) {
    data.pullRequests = {};
  }
  const pullRequests = data.pullRequests;
  fs.readdirSync("./data/PRs").filter(parsePRFilename).forEach(filename => {
    const { browser, prNumber } = parsePRFilename(filename);
    if (pullRequests[prNumber]?.[browser]) {
      console.log(`${filename} already processed - skipping`);
      return;
    }
    processPullRequestArtifact(data, filename);
  });

  fs.writeFileSync("../gh-pages/data.json", JSON.stringify(data));

  for (const browser of ["firefox", "chrome"]) {
    const suites = {};
    for (const suite of Object.keys(results).sort()) {
      const failing = [];
      const skipped = [];
      for (const spec in results[suite]) {
        switch (results[suite][spec][browser]?.[lastDay]) {
          case 1:
            skipped.push(spec);
            break;
          case 2:
          case 3:
            failing.push(spec);
            break;
        }
      }
      if (failing.length || skipped.length) {
        suites[suite] = {
          failing: failing.length ? failing : undefined,
          skipped: skipped.length ? skipped : undefined
        };
      }
    }
    fs.writeFileSync(`../gh-pages/${browser}-failing.json`, JSON.stringify(suites, null, 2));
  }

  processFirefoxFailures();
}

function processPullRequestArtifacts(prNumber) {
  const data = JSON.parse(fs.readFileSync("../gh-pages/data.json"));

  for (const browser of ["firefox", "chrome"]) {
    const filename = `${prNumber}-${browser}.zip`;
    if (fs.existsSync(`./data/PRs/${filename}`)) {
      processPullRequestArtifact(data, filename);
    } else {
      console.log(`Artifact ${filename} does not exist - skipping`);
    }
  }

  fs.writeFileSync("../gh-pages/data.json", JSON.stringify(data));
}

function processPullRequestArtifact(data, filename) {
    console.log(`Process ${filename}`);

    const pullRequests = data.pullRequests;
    const results = data.results;
    const { browser, prNumber } = parsePRFilename(filename);
    const report = readArtifact(`./data/PRs/${filename}`);

    for (const suite of Object.values(data.results)) {
      for (const spec of Object.values(suite)) {
        if (spec.pullRequests?.[browser]) {
          delete spec.pullRequests[browser][prNumber];
        }
      }
    }

    if (!pullRequests[prNumber]) {
      pullRequests[prNumber] = {};
    }
    pullRequests[prNumber].title = report.config.metadata.ci.prTitle;
    pullRequests[prNumber][browser] = {
      date: report.stats.startTime,
    };

    for (const suite of report.suites) {
      if (!results[suite.title]) {
        results[suite.title] = {};
      }
      forEachSpec(suite, (spec, path) => {
        const specPath = [...path, spec.title].join(" > ");
        const result = spec.tests[0].results[0].status;
        if (!results[suite.title][specPath]) {
          results[suite.title][specPath] = {};
        }
        if (!results[suite.title][specPath].pullRequests) {
          results[suite.title][specPath].pullRequests = {};
        }
        if (!results[suite.title][specPath].pullRequests[browser]) {
          results[suite.title][specPath].pullRequests[browser] = {};
        }
        results[suite.title][specPath].pullRequests[browser][prNumber] = RESULTS.indexOf(result);
      });
    }
}

function stripAnsiCodes(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function processFirefoxFailures() {
  const failuresFile = "../gh-pages/firefox-failures.json";
  let failures = {};
  let lastProcessedDay = -1;

  // Read existing failures file if it exists
  if (fs.existsSync(failuresFile)) {
    failures = JSON.parse(fs.readFileSync(failuresFile));
    // Find the last processed day
    for (const suiteTests of Object.values(failures)) {
      for (const testErrors of Object.values(suiteTests)) {
        for (const errorEntry of testErrors) {
          const dateParts = errorEntry.date.split("-");
          const dayIndex = getIndexForDate(dateParts);
          lastProcessedDay = Math.max(lastProcessedDay, dayIndex);
        }
      }
    }
  }

  // Process firefox zip files after lastProcessedDay
  const firefoxFiles = fs.readdirSync("./data")
    .filter(file => {
      const parsed = parseFilename(file);
      return parsed && parsed.browser === "firefox" && parsed.day > lastProcessedDay;
    })
    .sort((a, b) => parseFilename(a).day - parseFilename(b).day);

  firefoxFiles.forEach(filename => {
    console.log(`Processing failures from ${filename}`);

    const report = readArtifact(`./data/${filename}`);
    // Extract date from filename (e.g., "2025-09-25-firefox.zip" -> "2025-09-25")
    const date = filename.substring(0, filename.length - 12);

    for (const suite of report.suites) {
      forEachSpec(suite, (spec, path) => {
        const result = spec.tests[0].results[0];

        if (result && (result.status === "failed" || result.status === "timedOut")) {
          const errorText = result.error?.stack || result.error?.message || "Unknown error";
          const error = stripAnsiCodes(errorText);

          // Group by suite (top-level), then by spec path
          const suiteName = suite.title;
          const testName = [...path, spec.title].join(" > ");

          if (!failures[suiteName]) {
            failures[suiteName] = {};
          }
          if (!failures[suiteName][testName]) {
            failures[suiteName][testName] = [];
          }

          failures[suiteName][testName].push({
            date: date,
            error: error
          });

          // Keep only last 5 failures per test
          if (failures[suiteName][testName].length > 5) {
            failures[suiteName][testName].shift();
          }
        }
      });
    }
  });

  // Sort top-level properties alphabetically
  const sortedFailures = {};
  for (const key of Object.keys(failures).sort()) {
    sortedFailures[key] = failures[key];
  }

  fs.writeFileSync(failuresFile, JSON.stringify(sortedFailures, null, 2));
}

function forEachSpec(report, cb) {
  function processSuite(suite, path) {
    for (const spec of suite.specs || []) {
      cb(spec, path);
    }
    for (const childSuite of suite.suites || []) {
      processSuite(childSuite, [...path, childSuite.title]);
    }
  }
  processSuite(report, []);
}

function parseFilename(file) {
  if (!file.endsWith(".zip")) {
    return undefined;
  }
  const parts = file.substring(0, file.length - 4).split("-");
  if (parts.length !== 4 || !+parts[0] || !+parts[1] || !+parts[2]) {
    return undefined;
  }
  return {
    browser: parts[3],
    day: getIndexForDate(parts),
  };
}

function parsePRFilename(file) {
  if (!file.endsWith(".zip")) {
    return undefined;
  }
  const parts = file.substring(0, file.length - 4).split("-");
  if (parts.length !== 2) {
    return undefined;
  }
  return {
    prNumber: parts[0],
    browser: parts[1],
  };
}

const startDate = Date.UTC(2025, 8, 25);
const msPerDay = 24 * 60 * 60 * 1000;

function getIndexForDate(dateParts) {
  return (Date.UTC(+dateParts[0], +dateParts[1] - 1, +dateParts[2]) - startDate) / msPerDay;
}

function readArtifact(filename) {
  const zip = new AdmZip(filename);
  return JSON.parse(zip.readAsText("report.json"));
}

exports.processArtifacts = processArtifacts;
exports.processPullRequestArtifacts = processPullRequestArtifacts;
