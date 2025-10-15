const { downloadArtifacts } = require("./download");
const { processArtifacts } = require("./process");

(async () => {
  await downloadArtifacts();
  processArtifacts();
})();
