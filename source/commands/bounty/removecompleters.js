const { MessageFlags, userMention } = require("discord.js");
const { extractUserIdsFromMentions, listifyEN } = require("../../util/textUtil");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("remove-completers", "Remove hunter(s) from a bounty's list of completers",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, posterId]) {
		const slotNumber = interaction.options.getInteger("bounty-slot");
		logicLayer.bounties.findBounty({ userId: posterId, companyId: interaction.guild.id, slotNumber }).then(async bounty => {
			if (!bounty) {
				interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);
			if (mentionedIds.length < 1) {
				interaction.reply({ content: "Could not find any user mentions in `hunters`.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			logicLayer.bounties.deleteSelectedBountyCompletions(bounty.id, mentionedIds);
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
	}
).setOptions(
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
);
