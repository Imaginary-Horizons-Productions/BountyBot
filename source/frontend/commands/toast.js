const { PermissionFlagsBits, InteractionContextType, MessageFlags, userMention, unorderedList } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { textsHaveAutoModInfraction, sentenceListEN, refreshReferenceChannelScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, toastEmbed, secondingButtonRow, goalCompletionEmbed, sendRewardMessage, reloadHunterMapSubset, syncRankRoles, rewardSummary, consolidateHunterReceipts } = require('../shared');
const { Company } = require('../../database/models');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "toast";
module.exports = new CommandWrapper(mainId, "Raise a toast to other bounty hunter(s), usually granting +1 XP", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 30000,
	/** Provide 1 XP to mentioned hunters up to author's quota (10/48 hours), roll for crit toast (grants author XP) */
	async (interaction, origin, runMode) => {
		// Find valid toastees
		const bannedIds = new Set();
		const validatedToasteeIds = new Set();
		for (const optionalToastee of ["toastee", "second-toastee", "third-toastee", "fourth-toastee", "fifth-toastee"]) {
			const guildMember = interaction.options.getMember(optionalToastee);
			if (guildMember) {
				const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(guildMember.id, interaction.guild.id);
				if (hunter.isBanned) {
					bannedIds.add(guildMember.id);
				} else if (runMode !== "production" || (!guildMember.user.bot && guildMember.id !== interaction.user.id)) {
					validatedToasteeIds.add(guildMember.id);
				}
			}
		}

		let bannedText;
		if (bannedIds.size > 1) {
			bannedText = `${sentenceListEN(Array.from(bannedIds).map(id => userMention(id)))} were skipped because they're banned from using BountyBot on this server.`;
		} else if (bannedIds.size === 1) {
			bannedText = `${userMention(bannedIds.values().next().value)} was skipped because they're banned from using BountyBot on this server.`;
		}

		const errors = [];
		if (validatedToasteeIds.size < 1) {
			const sentences = ["No valid toastees received. You cannot raise a toast to yourself or a bot."];
			if (bannedText) {
				sentences.push(bannedText);
			}
			errors.push(sentences.join(" "));
		}

		// Validate image-url is a URL
		const imageURL = interaction.options.getString("image-url");
		try {
			if (imageURL) {
				new URL(imageURL);
			}
		} catch (error) {
			errors.push(error.message);
		}

		// Early-out if any errors
		if (errors.length > 0) {
			interaction.reply({ content: `The following errors were encountered while raising your toast:\n${unorderedList(errors)}`, flags: MessageFlags.Ephemeral });
			return;
		}

		const toastText = interaction.options.getString("message");
		const autoModInfraction = await textsHaveAutoModInfraction(interaction.channel, interaction.member, [toastText], "toast")
		if (autoModInfraction == null) {
			interaction.reply({ content: `Could not check if the toast breaks automod rules. ${interaction.client.user} may not have the Manage Server permission required to check the automod rules.`, flags: MessageFlags.Ephemeral });
			return;
		} else if (autoModInfraction) {
			interaction.reply({ content: "Your toast was blocked by AutoMod.", flags: MessageFlags.Ephemeral });
			return;
		}

		const season = await logicLayer.seasons.incrementSeasonStat(interaction.guild.id, "toastsRaised");
		let hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);
		const companyReceipt = { guildName: interaction.guild.name };

		const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
		const { toastId, hunterReceipts } = await logicLayer.toasts.raiseToast(interaction.guild, origin.company, interaction.user.id, validatedToasteeIds, hunterMap, season.id, toastText, imageURL);
		hunterMap = await reloadHunterMapSubset(hunterMap, Array.from(hunterReceipts.keys()));
		const currentCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
		if (previousCompanyLevel < currentCompanyLevel) {
			companyReceipt.levelUp = currentCompanyLevel;
		}

		const embeds = [];
		const goalProgress = { goalCompleted: false, currentGP: 0, requiredGP: 0 };
		if (hunterReceipts.size > 0) {
			const goalUpdate = await logicLayer.goals.progressGoal(interaction.guild.id, "toasts", hunterMap.get(interaction.user.id), season);
			goalProgress.goalCompleted = goalUpdate.goalCompleted;
			goalProgress.currentGP = goalUpdate.currentGP;
			goalProgress.requiredGP = goalUpdate.requiredGP;
			if (goalUpdate.gpContributed > 0) {
				companyReceipt.gp = goalUpdate.gpContributed;
				if (goalUpdate.goalCompleted) {
					embeds.push(goalCompletionEmbed(goalUpdate.contributorIds));
				}
			}
		}
		embeds.unshift(toastEmbed(origin.company.toastThumbnailURL, toastText, validatedToasteeIds, interaction.member, goalProgress, imageURL));

		interaction.reply({
			embeds,
			components: [secondingButtonRow(toastId)],
			withResponse: true
		}).then(async response => {
			if (bannedText) {
				interaction.followUp({ content: bannedText, flags: MessageFlags.Ephemeral });
			}
			if (hunterReceipts.size > 0) {
				const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
				const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
				const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await interaction.guild.roles.fetch());
				syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);

				consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
				sendRewardMessage(response.resource.message, rewardSummary("toast", companyReceipt, hunterReceipts, origin.company.maxSimBounties), "Rewards");
				const embeds = [];
				if (origin.company.scoreboardIsSeasonal) {
					embeds.push(await seasonalScoreboardEmbed(origin.company, interaction.guild, participationMap, descendingRanks, goalProgress));
				} else {
					embeds.push(await overallScoreboardEmbed(origin.company, interaction.guild, hunterMap, goalProgress));
				}
				refreshReferenceChannelScoreboard(origin.company, interaction.guild, embeds);
			}
		});
	}
).setOptions(
	{
		type: "String",
		name: "message",
		description: "The text of the toast to raise",
		required: true
	},
	{
		type: "User",
		name: "toastee",
		description: "A bounty hunter you are toasting to",
		required: true
	},
	{
		type: "User",
		name: "second-toastee",
		description: "A bounty hunter you are toasting to",
		required: false
	},
	{
		type: "User",
		name: "third-toastee",
		description: "A bounty hunter you are toasting to",
		required: false
	},
	{
		type: "User",
		name: "fourth-toastee",
		description: "A bounty hunter you are toasting to",
		required: false
	},
	{
		type: "User",
		name: "fifth-toastee",
		description: "A bounty hunter you are toasting to",
		required: false
	},
	{
		type: "String",
		name: "image-url",
		description: "The URL to the image to add to the toast",
		required: false
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
