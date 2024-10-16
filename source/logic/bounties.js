const { Sequelize } = require("sequelize");
const { Bounty } = require("../models/bounties/Bounty");
const { userMention, Guild } = require("discord.js");
const { listifyEN, congratulationBuilder } = require("../util/textUtil");

/**
 * @param {Guild} guild
 * @param {Sequelize} database
 * @param {Bounty} bounty
 * @param {Company} company
 * @param {string[]} completerIds
 */
function addCompleters(guild, database, bounty, company, completerIds) {
	const rawCompletions = [];
	for (const userId of completerIds) {
		rawCompletions.push({
			bountyId: bounty.id,
			userId,
			companyId: guild.id
		})
	}
	database.models.Completion.bulkCreate(rawCompletions);
	bounty.updatePosting(guild, company, database);
	if (company.bountyBoardId) {
		guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
			return bountyBoard.threads.fetch(bounty.postingId);
		}).then(posting => {
			posting.send({ content: `${listifyEN(completerIds.map(id => userMention(id)))} ${completerIds.length === 1 ? "has" : "have"} been added as ${completerIds.length === 1 ? "a completer" : "completers"} of this bounty! ${congratulationBuilder()}!` });
		});
	}
}

module.exports = {
	addCompleters
}
