const { readdirSync } = require('node:fs');
const { YukufyClient } = require('./src/utils/Player');

module.exports = YukufyClient;

require("./src/functions/Update");
//require("./src/functions/Test");

readdirSync('./src/utils').map(async file => {
	await require(`./src/utils/${file}`);
});

//© 2024 Yukufy Player Music - Kandaraku Studios | Owner - Developer: shindozk (CroneGamesPlays)
