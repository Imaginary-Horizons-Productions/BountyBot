const { Interaction, TextChannel, PermissionFlagsBits, userMention, Guild } = require("discord.js");
const { Bounty } = require("../models/bounties/Bounty");
const { Company } = require("../models/companies/Company");
const { Hunter } = require("../models/users/Hunter");
const { Sequelize } = require("sequelize");
const { listifyEN, congratulationBuilder } = require("./textUtil");

/**
 * @param {Interaction} interaction
 * @param {string} bountyId
 * @param {TextChannel} showcaseChannel
 * @param {boolean} isItemShowcase
 * @param {Sequelize} database
 */
async function showcaseBounty(interaction, bountyId, showcaseChannel, isItemShowcase, database) {
	if (!showcaseChannel.members.has(interaction.client.user.id)) {
		interaction.reply({ content: "BountyBot is not in the selected channel.", ephemeral: true });
		return;
	}

	if (!showcaseChannel.permissionsFor(interaction.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
		interaction.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", ephemeral: true });
		return;
	}

	const bounty = await database.models.Bounty.findByPk(bountyId);
	if (bounty?.state !== "open") {
		collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", ephemeral: true });
		return;
	}

	bounty.increment("showcaseCount");
	await bounty.save().then(bounty => bounty.reload());
	const company = await database.models.Company.findByPk(interaction.guildId);
	const poster = await database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } });
	if (!isItemShowcase) {
		poster.lastShowcaseTimestamp = new Date();
		poster.save();
	}
	bounty.updatePosting(interaction.guild, company, database);
	bounty.asEmbed(interaction.guild, poster.level, company.festivalMultiplierString(), false, database).then(async embed => {
		if (showcaseChannel.archived) {
			await showcaseChannel.setArchived(false, "bounty showcased");
		}
		showcaseChannel.send({ content: `${interaction.member} increased the reward on their bounty!`, embeds: [embed] });
	})
}

/**
 * 
 * @param {Bounty} bounty 
 * @param {Company} company 
 * @param {Hunter} poster 
 * @param {number|null} numCompleters 
 * @param {Guild} guild 
 */
async function updateBoardPosting(bounty, company, poster, numCompleters, guild) {
	bounty.updatePosting(); //Need to extract this into this function
	if (!company.bountyBoardId) return;
	let { boardId } = bounty;
	let postingId = company.bountyBoardId;
	if (boardId) {
		let boardsChannel = await guild.channels.fetch(boardId);
		let post = await boardsChannel.threads.fetch(postingId);
		if (post.archived) {
			await thread.setArchived(false, "Unarchived to update posting");
		}
		post.edit({ name: bounty.title });
		post.send({ content: `${listifyEN(completerIds.map(id => userMention(id)))} ${numCompleters === 1 ? "has" : "have"} been added as ${numCompleters === 1 ? "a completer" : "completers"} of this bounty! ${congratulationBuilder()}!` });
		let starterMessage = await post.fetchStarterMessage();
		starterMessage.edit({
			embeds: [bounty.asEmbed(guild, poster.level, company.festivalMultiplierString(), false, database)],
			components: bounty.generateBountyBoardButtons()
		});
	}
}

module.exports = {
	showcaseBounty,
	updateBoardPosting
}
