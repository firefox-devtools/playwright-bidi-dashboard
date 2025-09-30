const { createWriteStream, existsSync } = require("fs");
const { Readable } = require('stream');
const { finished } = require('stream/promises');

const repo = "microsoft/playwright";
const workflow = "tests_bidi.yml";
const artifactNames = {
  "firefox": "json-report-moz-firefox-nightly",
  "chrome": "json-report-bidi-chromium",
};

async function downloadLatestArtifacts() {
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?event=schedule&per_page=10`);
  const { workflow_runs } = await response.json();

  for (let i = 0; i < workflow_runs.length; i++) {
    const id = workflow_runs[i].id;
    const date = new Date(workflow_runs[i].run_started_at);
    if (Object.getOwnPropertyNames(artifactNames).some(browser => !existsSync(getFilename(browser, date)))) {
      await downloadWorkflowRunArtifacts(id, date);
    } else {
      console.log(`All files for ${getDateString(date)} already exist - stopping`);
      break;
    }
  }
}

async function downloadWorkflowRunArtifacts(id, date) {
  console.log(`Download artifacts for ${getDateString(date)}`);
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${id}/artifacts`)
  const artifacts = await response.json();

  for (const browser in artifactNames) {
    const filename = getFilename(browser, date);
    if (existsSync(filename)) {
      console.log(`${filename} already exists - skipping`);
      continue;
    }
    const artifact = artifacts.artifacts.find(artifact => artifact.name === artifactNames[browser]);
    if (artifact) {
      const response = await fetch(artifact.archive_download_url, {
        headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      });
      const fileStream = createWriteStream(filename);
      await finished(Readable.fromWeb(response.body).pipe(fileStream));
    }
  }
}

function getFilename(browser, date) {
  return `data/${browser}-${getDateString(date)}.zip`;
}

function getDateString(date) {
  return date.toISOString().substring(0, 10);
}

exports.downloadArtifacts = downloadLatestArtifacts;
