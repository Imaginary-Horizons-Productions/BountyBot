const { MessageFlags, userMention, bold } = require("discord.js");
const { listifyEN } = require("../../util/textUtil");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("revoke-turn-in", "Revoke the turn-ins of up to 5 bounty hunters on one of your bounties",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, posterId]) {
		const slotNumber = interaction.options.getInteger("bounty-slot");
		logicLayer.bounties.findBounty({ userId: posterId, companyId: interaction.guild.id, slotNumber }).then(async bounty => {
			if (!bounty) {
				interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			const hunterIds = [];
			for (const potentialHunter of ["bounty-hunter", "second-bounty-hunter", "third-bounty-hunter", "fourth-bounty-hunter", "fifth-bounty-hunter"]) {
				const guildMember = interaction.options.getMember(potentialHunter);
				if (guildMember) {
					hunterIds.push(guildMember.id);
				}
			}

			logicLayer.bounties.deleteSelectedBountyCompletions(bounty.id, hunterIds);
			const company = await logicLayer.companies.findCompanyByPK(interaction.guildId);
			bounty.updatePosting(interaction.guild, company, (await logicLayer.hunters.findOneHunter(posterId, interaction.guild.id)).level, await logicLayer.bounties.findBountyCompletions(bounty.id));
			if (company.bountyBoardId) {
				interaction.guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
					return bountyBoard.threads.fetch(bounty.postingId);
				}).then(posting => {
					posting.send({ content: `${listifyEN(hunterIds.map(id => `<@${id}>`))} ${hunterIds.length === 1 ? "has" : "have"} been removed as ${hunterIds.length === 1 ? "a completer" : "completers"} of this bounty.` });
				});
			}

			interaction.reply({ content: `The bounty hunters' turn-ins of ${bold(bounty.title)} have been revoked: ${listifyEN(hunterIds.map(id => userMention(id)))}`, flags: [MessageFlags.Ephemeral] });
		})
	}
).setOptions(
	{
		type: "Integer",
		name: "bounty-slot",
		description: "The slot number of your bounty",
		required: true
	},
	{
		type: "String",
		name: "bounty-hunter",
		description: "A bounty hunter to uncredit",
		required: true
	},
	{
		type: "String",
		name: "second-bounty-hunter",
		description: "A bounty hunter to uncredit",
		required: false
	},
	{
		type: "String",
		name: "third-bounty-hunter",
		description: "A bounty hunter to uncredit",
		required: false
	},
	{
		type: "String",
		name: "fourth-bounty-hunter",
		description: "A bounty hunter to uncredit",
		required: false
	},
	{
		type: "String",
		name: "fifth-bounty-hunter",
		description: "A bounty hunter to uncredit",
		required: false
	}
);
