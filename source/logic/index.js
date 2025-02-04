/**
 * A bundle of all (completed/ready) logic files so
 * they can be collectively set up in bot.js and
 * have relevant keys to be able to assign logic
 * files to commands/controllers
 */
module.exports = {
	bounties: require('./bounties.js'),
	companies: require("./companies.js"),
	hunters: require("./hunters.js"),
	toasts: require("./toasts.js")
};
