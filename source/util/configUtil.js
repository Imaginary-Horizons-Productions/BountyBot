/** @param {string[]} fileList */
function createSubcommandMappings(mainId, fileList) {
	const slashData = [];
	const executeDictionary = {};
	for (const fileName of fileList) {
		const subcommand = require(`../commands/${mainId}/${fileName}`);
		slashData.push(subcommand.data);
		executeDictionary[subcommand.data.name] = subcommand.executeSubcommand;
	};
	return {
		slashData,
		executeDictionary
	}
};

module.exports = {
	createSubcommandMappings
};
