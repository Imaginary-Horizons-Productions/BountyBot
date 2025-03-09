const { Interaction, TextChannel, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {Interaction} interaction
 * @param {string} bountyId
 * @param {TextChannel} showcaseChannel
 * @param {boolean} isItemShowcase
 * @param {Sequelize} database
 */
async function showcaseBounty(interaction, bountyId, showcaseChannel, isItemShowcase, database, logicLayer) {
	if (!showcaseChannel.members.has(interaction.client.user.id)) {
		interaction.reply({ content: "BountyBot is not in the selected channel.", flags: [MessageFlags.Ephemeral] });
		return;
	}

	if (!showcaseChannel.permissionsFor(interaction.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
		interaction.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: [MessageFlags.Ephemeral] });
		return;
	}

	const bounty = await logicLayer.bounties.findBounty(bountyId);
	if (bounty?.state !== "open") {
		collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", flags: [MessageFlags.Ephemeral] });
		return;
	}

	bounty.increment("showcaseCount");
	await bounty.save().then(bounty => bounty.reload());
	const company = await logicLayer.companies.findCompanyByPK(interaction.guild.id);
	const poster = await logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guildId);
	if (!isItemShowcase) {
		poster.lastShowcaseTimestamp = new Date();
		poster.save();
	}
	bounty.updatePosting(interaction.guild, company, database);
	bounty.embed(interaction.guild, poster.level, false, company, await database.models.Completion.findAll({ where: { bountyId: bounty.id } })).then(async embed => {
		if (showcaseChannel.archived) {
			await showcaseChannel.setArchived(false, "bounty showcased");
		}
		showcaseChannel.send({ content: `${interaction.member} increased the reward on their bounty!`, embeds: [embed] });
	})
}

module.exports = {
	showcaseBounty
}
