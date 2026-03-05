const { MessageFlags, heading, userMention } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { bountyEmbed } = require("../../shared");
const { Company } = require("../../../database/models");

module.exports = new SubcommandWrapper("list", "List all of a hunter's open bounties (default: your own)",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const listUserId = interaction.options.getUser("bounty-hunter")?.id ?? interaction.user.id;
		const isEvergreen = listUserId === interaction.client.user.id;
		const existingBounties = await logicLayer.bounties.findOpenBounties(listUserId, interaction.guild.id);
		if (existingBounties.length < 1) {
			let content;
			if (isEvergreen) {
				content = `${interaction.guild.name} doesn't have any evergreen bounties posted.`;
			} else {
				content = `${userMention(listUserId)} doesn't have any open bounties posted.`;
			}
			interaction.reply({ content, flags: MessageFlags.Ephemeral });
			return;
		}

		const replyPayload = { flags: MessageFlags.Ephemeral };
		if (isEvergreen) {
			const companyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id)));
			replyPayload.content = heading(`Evergreen Bounties on ${interaction.guild.name}`, 2);
			replyPayload.embeds = await Promise.all(existingBounties.map(async bounty => bountyEmbed(bounty, interaction.guild.members.me, companyLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(bounty.id))));
		} else {
			replyPayload.content = heading(`${userMention(listUserId)}'s Bounties`, 2);
			if (listUserId === origin.hunter.userId) {
				const hunterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
				replyPayload.embeds = await Promise.all(existingBounties.map(async bounty => bountyEmbed(bounty, interaction.member, hunterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(interaction.guild.scheduledEvents))));
			} else {
				const hunter = await logicLayer.hunters.findOneHunter(listUserId, interaction.guild.id);
				const hunterLevel = hunter.getLevel(origin.company.xpCoefficient);
				const guildMember = await interaction.guild.members.fetch(listUserId);
				replyPayload.embeds = await Promise.all(existingBounties.map(async bounty => bountyEmbed(bounty, guildMember, hunterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(interaction.guild.scheduledEvents))));
			}
		}
		interaction.reply(replyPayload);
	}
).setOptions(
	{
		type: "User",
		name: "bounty-hunter",
		description: "The bounty hunter to show open bounties for",
		required: false
	}
);
