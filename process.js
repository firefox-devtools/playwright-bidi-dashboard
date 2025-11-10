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
