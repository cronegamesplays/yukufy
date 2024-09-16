const { readdirSync } = require('node:fs');
const { DistifyClient } = require('./src/utils/Player');

module.exports = DistifyClient;

require("./src/functions/Update");
require("./src/functions/Test");

readdirSync('./src/utils').map(async file => {
	await require(`./src/utils/${file}`);
});

//© 2024 Distify Player Music - Kandaraku Studios | Owner - Developer: shindozk (CroneGamesPlays)