const { downloadPullRequestArtifacts } = require("./download");
const { processPullRequestArtifacts } = require("./process");

(async () => {
  await downloadPullRequestArtifacts(process.env.PR_NUMBER);
  processPullRequestArtifacts(process.env.PR_NUMBER);
})();
