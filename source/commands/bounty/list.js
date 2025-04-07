const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("list", "List all of a hunter's open bounties (default: your own)",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, userId]) {
		const listUserId = interaction.options.getUser("bounty-hunter")?.id ?? userId;
		if (listUserId === interaction.client.user.id) {
			// Evergreen
			logicLayer.bounties.findOpenBounties(listUserId, interaction.guild.id).then(async existingBounties => {
				if (existingBounties.length < 1) {
					interaction.reply({ content: `${interaction.guild.name} doesn't have any evergreen bounties posted.`, flags: [MessageFlags.Ephemeral] });
					return;
				}
				const allHunters = await logicLayer.hunters.findCompanyHunters(interaction.guild.id);
				const company = await logicLayer.companies.findCompanyByPK(interaction.guildId);
				const companyLevel = company.getLevel(allHunters);
				interaction.reply({ embeds: await Promise.all(existingBounties.map(async bounty => bounty.embed(interaction.guild, companyLevel, false, company, await logicLayer.bounties.findBountyCompletions(bounty.id)))), flags: [MessageFlags.Ephemeral] });
			});
		} else {
			logicLayer.bounties.findOpenBounties(listUserId, interaction.guild.id).then(async existingBounties => {
				if (existingBounties.length < 1) {
					interaction.reply({ content: `<@${listUserId}> doesn't have any open bounties posted.`, flags: [MessageFlags.Ephemeral] });
					return;
				}
				const hunter = await logicLayer.hunters.findOneHunter(listUserId, interaction.guild.id);
				const company = await logicLayer.companies.findCompanyByPK(interaction.guildId);
				interaction.reply({ embeds: await Promise.all(existingBounties.map(async bounty => bounty.embed(interaction.guild, hunter.getLevel(company.xpCoefficient), false, company, await logicLayer.bounties.findBountyCompletions(bounty.id)))), flags: [MessageFlags.Ephemeral] });
			});
		}
	}
).setOptions(
	{
		type: "User",
		name: "bounty-hunter",
		description: "The bounty hunter to show open bounties for",
		required: false
	}
);
