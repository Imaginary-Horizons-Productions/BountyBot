const { PermissionFlagsBits, InteractionContextType, MessageFlags, userMention, unorderedList } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { textsHaveAutoModInfraction, fillableTextBar, sentenceListEN, refreshReferenceChannelScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, toastEmbed, secondingButtonRow, rewardStringToast, goalCompletionEmbed, sendRewardMessage, rewardTextsHunterResults, reloadHunterMapSubset, companyLevelUpLine, formatSeasonResultsToRewardTexts, syncRankRoles } = require('../shared');
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
		if (await textsHaveAutoModInfraction(interaction.channel, interaction.member, [toastText], "toast")) {
			interaction.reply({ content: "Your toast was blocked by AutoMod.", flags: MessageFlags.Ephemeral });
			return;
		}

		const season = await logicLayer.seasons.incrementSeasonStat(interaction.guild.id, "toastsRaised");
		let hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);

		const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
		const { toastId, rewardedHunterIds, hunterResults, critValue } = await logicLayer.toasts.raiseToast(interaction.guild, origin.company, interaction.user.id, validatedToasteeIds, hunterMap, season.id, toastText, imageURL);
		hunterMap = await reloadHunterMapSubset(hunterMap, rewardedHunterIds.concat(interaction.user.id));
		const rewardTexts = rewardTextsHunterResults(hunterResults, hunterMap, origin.company);
		const companyLevelLine = companyLevelUpLine(origin.company, previousCompanyLevel, hunterMap, interaction.guild.name);
		if (companyLevelLine) {
			rewardTexts.push(companyLevelLine);
		}
		const embeds = [toastEmbed(origin.company.toastThumbnailURL, toastText, validatedToasteeIds, interaction.member)];
		if (imageURL) {
			embeds[0].setImage(imageURL);
		}

		if (rewardedHunterIds.length > 0) {
			const goalUpdate = await logicLayer.goals.progressGoal(interaction.guild.id, "toasts", hunterMap.get(interaction.user.id), season);
			if (goalUpdate.gpContributed > 0) {
				rewardTexts.push(`This toast contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
				if (goalUpdate.goalCompleted) {
					embeds.push(goalCompletionEmbed(goalUpdate.contributorIds));
				}
				const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
				if (goalId !== null) {
					embeds[0].addFields({ name: "Server Goal", value: `${fillableTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
				} else {
					embeds[0].addFields({ name: "Server Goal", value: `${fillableTextBar(15, 15, 15)} Completed!` });
				}
			}
		}

		interaction.reply({
			embeds,
			components: [secondingButtonRow(toastId)],
			withResponse: true
		}).then(async response => {
			if (bannedText) {
				interaction.followUp({ content: bannedText, flags: MessageFlags.Ephemeral });
			}
			if (rewardedHunterIds.length > 0) {
				const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
				const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
				const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks);
				syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);
				const rewardString = rewardStringToast(rewardedHunterIds, formatSeasonResultsToRewardTexts(seasonUpdates, descendingRanks, await interaction.guild.roles.fetch()), rewardTexts, interaction.member.toString(), origin.company.festivalMultiplierString(), critValue);
				sendRewardMessage(response.resource.message, rewardString, "Rewards");
				const embeds = [];
				const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
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
