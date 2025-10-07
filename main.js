const { downloadArtifacts } = require("./download");
const { processArtifacts, generateDiffs } = require("./process");

(async () => {
  await downloadArtifacts();
  processArtifacts();
  generateDiffs();
})();
