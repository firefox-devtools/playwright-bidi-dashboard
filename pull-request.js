const { downloadPullRequestArtifacts } = require("./download");
const { processArtifacts } = require("./process");

(async () => {
  await downloadPullRequestArtifacts(process.env.PR_NUMBER);
  processArtifacts();
})();
