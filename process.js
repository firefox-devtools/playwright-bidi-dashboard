const fs = require("fs");
const AdmZip = require("adm-zip");

const RESULTS = ["passed", "skipped", "failed", "timedOut"];

function processArtifacts() {
  const data = JSON.parse(fs.readFileSync("../gh-pages/data.json"));

  let lastDay = 0;
  fs.readdirSync("./data").filter(parseFilename).forEach(filename => {
    const { browser, day } = parseFilename(filename);
    lastDay = Math.max(lastDay, day);
    if (Object.values(data).some(suite => Object.values(suite).some(spec => !!spec[browser][day]))) {
      console.log(`${filename} already processed - skipping`);
      return;
    }

    console.log(`Process ${filename}`);
    const report = readArtifact(`./data/${filename}`);
    for (const suite of report.suites) {
      if (!data[suite.title]) {
        data[suite.title] = {};
      }
      forEachSpec(suite, (spec, path) => {
        const specPath = [...path, spec.title].join(" > ");
        const result = spec.tests[0].results[0].status;
        if (!data[suite.title][specPath]) {
          data[suite.title][specPath] = { firefox: [], chrome: [] };
        }
        data[suite.title][specPath][browser][day] = RESULTS.indexOf(result);
      });
    }
  });

  fs.writeFileSync("../gh-pages/data.json", JSON.stringify(data));

  for (const browser of ["firefox", "chrome"]) {
    const suites = {};
    for (const suite of Object.keys(data).sort()) {
      const failing = [];
      const skipped = [];
      for (const spec in data[suite]) {
        switch (data[suite][spec][browser][lastDay]) {
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

const startDate = Date.UTC(2025, 8, 25);
const msPerDay = 24 * 60 * 60 * 1000;

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
    day: (Date.UTC(+parts[0], +parts[1] - 1, +parts[2]) - startDate) / msPerDay,
  };
}

function readArtifact(filename) {
  const zip = new AdmZip(filename);
  return JSON.parse(zip.readAsText("report.json"));
}

exports.processArtifacts = processArtifacts;
