const axios = require("axios");
const semver = require("semver"); // Para comparar as versões
const packageVersion = require("./package.json").version;

async function checkForUpdates() {
  try {
    const response = await axios.get("https://registry.npmjs.com/distify");
    const latestVersion = response.data["dist-tags"].latest;

    if (semver.gt(latestVersion, packageVersion)) {
      console.log(`\x1b[38;5;215mVocê está usando uma versão desatualizada do Kandaraku. Atualize para a versão mais recente usando o comando: \x1b[38;5;119m'npm i kandaraku@${latestVersion}'\x1b[38;5;215m para obter as últimas funcionalidades e correções de bugs.\x1B[0m`);
    }
  } catch (err) {
    console.error("Erro ao verificar atualizações:", err);
  }
}

// Verificar atualizações a cada 5 minutos (300.000 milissegundos)
setInterval(checkForUpdates, 1000 * 300000);

// Execute a verificação imediatamente ao iniciar o script
checkForUpdates();
