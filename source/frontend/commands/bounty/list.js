const { MessageFlags, heading, userMention } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { buildBountyEmbed } = require("../../shared");

module.exports = new SubcommandWrapper("list", "List all of a hunter's open bounties (default: your own)",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const listUserId = interaction.options.getUser("bounty-hunter")?.id ?? interaction.user.id;
		if (listUserId === interaction.client.user.id) {
			// Evergreen
			logicLayer.bounties.findOpenBounties(listUserId, interaction.guild.id).then(async existingBounties => {
				if (existingBounties.length < 1) {
					interaction.reply({ content: `${interaction.guild.name} doesn't have any evergreen bounties posted.`, flags: MessageFlags.Ephemeral });
					return;
				}
				const allHunters = await logicLayer.hunters.findCompanyHunters(interaction.guild.id);
				const company = await logicLayer.companies.findCompanyByPK(interaction.guildId);
				const companyLevel = company.getLevel(allHunters);
				interaction.reply({ content: heading(`Evergreen Bounties on ${interaction.guild.name}`, 2), embeds: await Promise.all(existingBounties.map(async bounty => buildBountyEmbed(bounty, interaction.guild, companyLevel, false, company, await logicLayer.bounties.getHunterIdSet(bounty.id)))), flags: MessageFlags.Ephemeral });
			});
		} else {
			logicLayer.bounties.findOpenBounties(listUserId, interaction.guild.id).then(async existingBounties => {
				if (existingBounties.length < 1) {
					interaction.reply({ content: `<@${listUserId}> doesn't have any open bounties posted.`, flags: MessageFlags.Ephemeral });
					return;
				}
				const hunter = await logicLayer.hunters.findOneHunter(listUserId, interaction.guild.id);
				const company = await logicLayer.companies.findCompanyByPK(interaction.guildId);
				interaction.reply({ content: heading(`${userMention(listUserId)}'s Bounties`, 2), embeds: await Promise.all(existingBounties.map(async bounty => buildBountyEmbed(bounty, interaction.guild, hunter.getLevel(company.xpCoefficient), false, company, await logicLayer.bounties.getHunterIdSet(bounty.id)))), flags: MessageFlags.Ephemeral });
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
