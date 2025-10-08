const fs = require("fs");
const AdmZip = require("adm-zip");

const PASSED = "passed";
const FAILED = "failed";
const TIMEOUT = "timedOut";
const SKIPPED = "skipped";

function processArtifacts() {
  const data = JSON.parse(fs.readFileSync("../gh-pages/data.json"));
  let mostRecent = 0;

  fs.readdirSync("./data").filter(parseFilename).forEach(filename => {
    const { browser, date } = parseFilename(filename);
    mostRecent = Math.max(mostRecent, date);

    let entryForDate = data.find(entry => entry.date === new Date(date).getTime());
    if (!entryForDate) {
      entryForDate = { date };
      data.push(entryForDate);
    }

    const countsProperty = `${browser}Counts`;
    if (countsProperty in entryForDate) {
      console.log(`${filename} already processed - skipping`);
      return;
    }

    console.log(`Process ${filename}`);
    const json = readArtifact(`./data/${filename}`);
    const counts = {
      passing: 0,
      failing: 0,
      skipping: 0,
      bySuite: {},
    };
    for (const suite of json.suites) {
      const suiteCounts = {
        passing: 0,
        failing: 0,
        skipping: 0,
      };
      function processSuite(suite) {
        for (const spec of suite.specs) {
          const result = spec.tests[0].results[0].status;
          switch (result) {
            case PASSED:
              suiteCounts.passing++;
              break;
            case FAILED:
            case TIMEOUT:
              suiteCounts.failing++;
              break;
            case SKIPPED:
              suiteCounts.skipping++;
              break;
          }
        }
        for (const childSuite of suite.suites || []) {
          processSuite(childSuite);
        }
      }
      processSuite(suite);
      counts.bySuite[suite.title] = suiteCounts;
      counts.passing += suiteCounts.passing;
      counts.failing += suiteCounts.failing;
      counts.skipping += suiteCounts.skipping;
    }

    data.sort((a, b) => a.date - b.date);

    entryForDate[`${browser}Counts`] = {
      ...counts,
      total: counts.passing + counts.failing + counts.skipping,
    };
  });

  fs.writeFileSync("../gh-pages/data.json", JSON.stringify(data, null, 2));

  for (const browser of ["firefox", "chrome"]) {
    const filename = `./data/${formatDate(new Date(mostRecent))}-${browser}.zip`;
    if (fs.existsSync(filename)) {
      const json = readArtifact(filename);
      const suites = {};
      for (const suite of json.suites) {
        const failing = [];
        const skipped = [];
        function processSuite(suite) {
          for (const spec of suite.specs) {
            const result = spec.tests[0].results[0].status;
            switch (result) {
              case FAILED:
              case TIMEOUT:
                failing.push(spec.title);
                break;
              case SKIPPED:
                skipped.push(spec.title);
                break;
            }
          }
          for (const childSuite of suite.suites || []) {
            processSuite(childSuite);
          }
        }
        processSuite(suite);

        if (failing.length || skipped.length) {
          suites[suite.title] = {
            failing: failing.length ? failing : undefined,
            skipped: skipped.length ? skipped : undefined
          };
        }
      }
      fs.writeFileSync(`../gh-pages/${browser}-failing.json`, JSON.stringify(suites, null, 2));
    } else {
      fs.writeFileSync(`../gh-pages/${browser}-failing.json`, "{}");
    }
  }
}

function generateDiffs() {
  const reports = { firefox: [], chrome: [] };
  fs.readdirSync("./data").filter(parseFilename).forEach(filename => {
    const { browser, date } = parseFilename(filename);
    reports[browser].push({ date, filename });
  });
  for (const browser of ["firefox", "chrome"]) {
    const browserReports = reports[browser];
    if (browserReports.length < 2) {
      continue;
    }
    browserReports.sort((a, b) => a.date - b.date);
    let previousReport = readArtifact(`./data/${browserReports[0].filename}`);
    for (let i = 1; i < browserReports.length; i++) {
      const currentReport = readArtifact(`./data/${browserReports[i].filename}`);
      const filename = `../gh-pages/diff/${formatDate(new Date(browserReports[i].date))}-${browser}.json`;
      if (!fs.existsSync(filename)) {
        console.log(`Diff ${browserReports[i].filename}`);
        const diff = generateDiff(previousReport, currentReport);
        fs.writeFileSync(filename, JSON.stringify(diff, null, 2));
      } else {
        console.log(`${browserReports[i].filename} already diffed - skipping`);
      }
      previousReport = currentReport;
    }
  }
}

function generateDiff(previousReport, currentReport) {
  const diff = {};
  forEachSpec(previousReport, (spec, path) => {
    const specPath = `${path.join(" > ")} > ${spec.title}`;
    const result = spec.tests[0].results[0].status;
    diff[specPath] = { previous: result };
  });
  forEachSpec(currentReport, (spec, path) => {
    const specPath = `${path.join(" > ")} > ${spec.title}`;
    const result = spec.tests[0].results[0].status;
    let testResults = diff[specPath];
    if (!testResults) {
      testResults = {};
      diff[specPath] = testResults;
    }
    testResults.current = result;
  });
  for (const specPath in diff) {
    const testResults = diff[specPath];
    if (testResults.previous === testResults.current) {
      delete diff[specPath];
    }
  }
  return diff;
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
    date: Date.UTC(+parts[0], +parts[1] - 1, +parts[2]),
  };
}

function readArtifact(filename) {
  const zip = new AdmZip(filename);
  return JSON.parse(zip.readAsText("report.json"));
}

function formatDate(date) {
  return date.toISOString().substring(0, 10);
}

exports.processArtifacts = processArtifacts;
exports.generateDiffs = generateDiffs;
