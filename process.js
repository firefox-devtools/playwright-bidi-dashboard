const fs = require("fs");
const AdmZip = require("adm-zip");

const PASSED = "passed";
const FAILED = "failed";
const TIMEOUT = "timedOut";
const SKIPPED = "skipped";

function processArtifacts() {
  const data = JSON.parse(fs.readFileSync("../gh-pages/data.json"));

  fs.readdirSync("./data").filter(parseFilename).forEach(filename => {
    const { browser, date } = parseFilename(filename);

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
    const zip = new AdmZip(`./data/${filename}`);
    const json = JSON.parse(zip.readAsText("report.json"));
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
}

exports.processArtifacts = processArtifacts;
