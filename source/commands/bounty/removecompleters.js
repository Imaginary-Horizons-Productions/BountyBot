const { CommandInteraction } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { extractUserIdsFromMentions } = require("../../util/textUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	const slotNumber = interaction.options.getInteger("bounty-slot");
	database.models.Bounty.findOne({ where: { userId: posterId, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
		if (!bounty) {
			interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", ephemeral: true });
			return;
		}

		const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);
		if (mentionedIds.length < 1) {
			interaction.reply({ content: "Could not find any user mentions in `hunters`.", ephemeral: true });
			return;
		}

		database.models.Completion.destroy({ where: { bountyId: bounty.id, userId: { [Op.in]: mentionedIds } } });
		const company = await database.models.Company.findByPk(interaction.guildId);
		bounty.updatePosting(interaction.guild, company, database);

		interaction.reply({ //TODO #95 make sure acknowledging interactions is sharding safe
			content: `The following bounty hunters have been removed as completers from **${bounty.title}**: <@${mentionedIds.join(">, ")}>`,
			ephemeral: true
		});
	})
};

module.exports = {
	data: {
		name: "remove-completers",
		description: "Remove hunter(s) from a bounty's list of completers",
		optionsInput: [
			{
				type: "Integer",
				name: "bounty-slot",
				description: "The slot number of the bounty from which to remove completers",
				required: true
			},
			{
				type: "String",
				name: "hunters",
				description: "The bounty hunter(s) to remove",
				required: true
			}
		]
	},
	executeSubcommand
};
