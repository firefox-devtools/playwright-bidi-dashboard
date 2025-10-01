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

    entryForDate[`${browser}Counts`] = {
      ...counts,
      total: counts.passing + counts.failing + counts.skipping,
    };
  });

  fs.writeFileSync("../gh-pages/data.json", JSON.stringify(data, null, 2));

  for (const browser of ["firefox", "chrome"]) {
    const filename = `./data/${browser}-${formatDate(new Date(mostRecent))}.zip`;
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

function parseFilename(file) {
  if (!file.endsWith(".zip")) {
    return undefined;
  }
  const parts = file.substring(0, file.length - 4).split("-");
  if (parts.length !== 4 || !+parts[1] || !+parts[2] || !+parts[3]) {
    return undefined;
  }
  return {
    browser: parts[0],
    date: Date.UTC(+parts[1], +parts[2] - 1, +parts[3]),
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
