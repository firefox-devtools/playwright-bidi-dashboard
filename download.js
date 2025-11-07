const { createWriteStream, existsSync } = require("fs");
const { Readable } = require('stream');
const { finished } = require('stream/promises');

const repo = "microsoft/playwright";
const workflow = "tests_bidi.yml";
const workflowPath = ".github/workflows/tests_bidi.yml";
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
    const dateString = getDateString(date);
    if (Object.getOwnPropertyNames(artifactNames).some(browser => !existsSync(getFilename(browser, dateString)))) {
      await downloadWorkflowRunArtifacts(id, dateString, true);
    } else {
      console.log(`All files for ${dateString} already exist - stopping`);
      break;
    }
  }
}

async function downloadPullRequestArtifacts(prNumber) {
  const prResponse = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`);
  const prData = await prResponse.json();
  const headSha = prData.head.sha;

  const runsResponse = await fetch(`https://api.github.com/repos/${repo}/actions/runs?head_sha=${headSha}`);
  const { workflow_runs } = await runsResponse.json();
  const id = workflow_runs.find(run => run.path === workflowPath).id;

  await downloadWorkflowRunArtifacts(id, `PRs/${prNumber}`, false);
}

async function downloadWorkflowRunArtifacts(id, filenamePrefix, skipIfExists) {
  console.log(`Download artifacts for ${filenamePrefix}`);
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${id}/artifacts`)
  const artifacts = await response.json();

  for (const browser in artifactNames) {
    const filename = getFilename(browser, filenamePrefix);
    if (skipIfExists && existsSync(filename)) {
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

function getFilename(browser, filenamePrefix) {
  return `data/${filenamePrefix}-${browser}.zip`;
}

function getDateString(date) {
  return date.toISOString().substring(0, 10);
}

exports.downloadArtifacts = downloadLatestArtifacts;
exports.downloadPullRequestArtifacts = downloadPullRequestArtifacts;
