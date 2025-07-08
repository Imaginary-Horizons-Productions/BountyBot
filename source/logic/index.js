/**
 * A bundle of all (completed/ready) logic files so
 * they can be collectively set up in bot.js and
 * have relevant keys to be able to assign logic
 * files to commands/controllers
 */
module.exports = {
	bounties: require('./bounties.js'),
	companies: require("./companies.js"),
	goals: require("./goals.js"),
	hunters: require("./hunters.js"),
	ranks: require("./ranks.js"),
	items: require("./items.js"),
	seasons: require("./seasons.js"),
	toasts: require("./toasts.js"),
	cooldowns: require("./cooldowns.js")
};
