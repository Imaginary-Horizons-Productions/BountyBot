const { CommandInteraction, MessageFlags, userMention } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { extractUserIdsFromMentions, listifyEN } = require("../../util/textUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic"), string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer, posterId]) {
	const slotNumber = interaction.options.getInteger("bounty-slot");
	database.models.Bounty.findOne({ where: { userId: posterId, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
		if (!bounty) {
			interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);
		if (mentionedIds.length < 1) {
			interaction.reply({ content: "Could not find any user mentions in `hunters`.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		database.models.Completion.destroy({ where: { bountyId: bounty.id, userId: { [Op.in]: mentionedIds } } });
		const company = await logicLayer.companies.findCompanyByPK(interaction.guildId);
		bounty.updatePosting(interaction.guild, company, (await logicLayer.hunters.findOneHunter(posterId, interaction.guild.id)).level, await logicLayer.bounties.findBountyCompletions(bounty.id));
		if (company.bountyBoardId) {
			interaction.guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
				return bountyBoard.threads.fetch(bounty.postingId);
			}).then(posting => {
				posting.send({ content: `${listifyEN(mentionedIds.map(id => `<@${id}>`))} ${mentionedIds.length === 1 ? "has" : "have"} been removed as ${mentionedIds.length === 1 ? "a completer" : "completers"} of this bounty.` });
			});
		}

		interaction.reply({ content: `The following bounty hunters have been removed as completers from **${bounty.title}**: ${listifyEN(mentionedIds.map(id => userMention(id)))}`, flags: [MessageFlags.Ephemeral] });
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
