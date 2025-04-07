const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("list", "List all of a hunter's open bounties (default: your own)",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, userId]) {
		const listUserId = interaction.options.getUser("bounty-hunter")?.id ?? userId;
		logicLayer.bounties.findOpenBounties(listUserId, interaction.guild.id).then(async existingBounties => {
			if (existingBounties.length < 1) {
				interaction.reply({ content: `<@${listUserId}> doesn't have any open bounties posted.`, flags: [MessageFlags.Ephemeral] });
				return;
			}
			const allHunters = await logicLayer.hunters.findCompanyHunters(interaction.guild.id);
			const hunter = allHunters.find(hunter => hunter.userId === listUserId);
			const company = await logicLayer.companies.findCompanyByPK(interaction.guildId);
			//TODONOW non-extent hunter is probably a bad check for evergreens
			interaction.reply({ embeds: await Promise.all(existingBounties.map(async bounty => bounty.embed(interaction.guild, hunter?.getLevel(company.xpCoefficient) ?? company.getLevel(allHunters), false, company, await logicLayer.bounties.findBountyCompletions(bounty.id)))), flags: [MessageFlags.Ephemeral] });
		});
	}
).setOptions(
	{
		type: "User",
		name: "bounty-hunter",
		description: "The bounty hunter to show open bounties for",
		required: false
	}
);
