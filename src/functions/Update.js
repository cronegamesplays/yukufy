const axios = require("axios");
const semver = require("semver");
const packageVersion = require("../../package.json").version;

async function checkForUpdates() {
  try {
    const response = await axios.get("https://registry.npmjs.com/distify.js");
    const latestVersion = response.data["dist-tags"].latest;

    if (semver.gt(latestVersion, packageVersion)) {
      console.log(`\x1b[38;5;215mYou are using an outdated version of Distify.js. Update to the latest version using the command: \x1b[38;5;119m'npm i distify.js@${latestVersion}'\x1b[38;5;215m to get new features and bug fixes.\x1B[0m`);
    }
  } catch (err) {
    console.error("Error checking for updates:", err);
  }
}

// Check for updates every 5 minutes (300,000 milliseconds)
setInterval(checkForUpdates, 1000 * 300000);

checkForUpdates();