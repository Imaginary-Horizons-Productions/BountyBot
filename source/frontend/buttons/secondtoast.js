const { EmbedBuilder, MessageFlags } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { generateTextBar, buildCompanyLevelUpLine, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, buildHunterLevelUpLine, generateCompletionEmbed, generateSecondingRewardString, sendToRewardsThread, formatSeasonResultsToRewardTexts, syncRankRoles } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "secondtoast";
module.exports = new ButtonWrapper(mainId, 3000,
	/** Provide each recipient of a toast an extra XP, roll crit toast for author, and update embed */
	async (interaction, runMode, [toastId]) => {
		const originalToast = await logicLayer.toasts.findToastByPK(toastId);
		if (runMode === "production" && originalToast.senderId === interaction.user.id) {
			interaction.reply({ content: "You cannot second your own toast.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (await logicLayer.toasts.wasAlreadySeconded(toastId, interaction.user.id)) {
			interaction.reply({ content: "You've already seconded this toast.", flags: MessageFlags.Ephemeral });
			return;
		}

		const [seconder] = await logicLayer.hunters.findOrCreateBountyHunter(interaction.user.id, interaction.guild.id);
		seconder.increment("toastsSeconded");
		originalToast.increment("secondings");
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
		const progressData = await logicLayer.goals.progressGoal(interaction.guildId, "secondings", seconder, season);
		const rewardTexts = [];
		if (progressData.gpContributed != 0) {
			rewardTexts.push(`This seconding contributed ${progressData.gpContributed} GP to the Server Goal!`);
		}

		const recipientIds = [];
		originalToast.Recipients.forEach(reciept => {
			if (reciept.recipientId !== interaction.user.id) {
				recipientIds.push(reciept.recipientId);
			}
		});
		const company = await logicLayer.companies.findCompanyByPK(interaction.guild.id);
		const allHunters = await logicLayer.hunters.findCompanyHunters(interaction.guild.id);
		const previousCompanyLevel = company.getLevel(allHunters);
		for (const userId of recipientIds) {
			logicLayer.seasons.changeSeasonXP(userId, interaction.guildId, season.id, 1);
			const hunter = await logicLayer.hunters.findOneHunter(userId, interaction.guild.id);
			const previousLevel = hunter.getLevel(company.xpCoefficient);
			await hunter.increment({ toastsReceived: 1, xp: 1 }).then(hunter => hunter.reload());
			const hunterLevelLine = buildHunterLevelUpLine(hunter, previousLevel, company.xpCoefficient, company.maxSimBounties);
			if (hunterLevelLine) {
				rewardTexts.push(hunterLevelLine);
			}
		}

		const recentToasts = await logicLayer.toasts.findRecentSecondings(interaction.user.id);
		let critSecondsAvailable = 2;
		for (const seconding of recentToasts) {
			if (seconding.wasCrit) {
				critSecondsAvailable--;
				if (critSecondsAvailable < 1) {
					break;
				}
			}
		}

		let critSeconds = 0;
		const startingSeconderLevel = seconder.getLevel(company.xpCoefficient);
		if (critSecondsAvailable > 0) {
			const staleToastees = await logicLayer.toasts.findStaleToasteeIds(interaction.user.id, interaction.guild.id);
			let lowestEffectiveToastLevel = startingSeconderLevel + 2;
			for (const userId of recipientIds) {
				// Calculate crit
				let effectiveToastLevel = startingSeconderLevel + 2;
				for (const staleId of staleToastees) {
					if (userId == staleId) {
						effectiveToastLevel--;
						if (effectiveToastLevel < 2) {
							break;
						}
					}
				};
				if (effectiveToastLevel < lowestEffectiveToastLevel) {
					lowestEffectiveToastLevel = effectiveToastLevel;
				}
			}

			// f(x) = 150/(x+2)^(1/3)
			const critRoll = Math.random() * 100;
			if (critRoll * critRoll * critRoll > 3375000 / lowestEffectiveToastLevel) {
				critSeconds++;
				recipientIds.push(interaction.user.id);
			}
		}
		const companyLevelLine = buildCompanyLevelUpLine(company, previousCompanyLevel, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), interaction.guild.name);
		if (companyLevelLine) {
			rewardTexts.push(companyLevelLine);
		}

		logicLayer.toasts.createSeconding(originalToast.id, interaction.user.id, critSeconds > 0);
		if (critSeconds > 0) {
			await seconder.increment({ xp: critSeconds }).then(seconder => seconder.reload());
			const hunterLevelLine = buildHunterLevelUpLine(seconder, startingSeconderLevel, company.xpCoefficient, company.maxSimBounties);
			if (hunterLevelLine) {
				rewardTexts.push(hunterLevelLine);
			}
			logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, critSeconds);
		}

		const embed = new EmbedBuilder(interaction.message.embeds[0].data);
		const secondedFieldIndex = embed.data.fields?.findIndex(field => field.name === "Seconded by") ?? -1;
		if (secondedFieldIndex === -1) {
			embed.addFields({ name: "Seconded by", value: interaction.member.toString() });
		} else {
			embed.spliceFields(secondedFieldIndex, 1, { name: "Seconded by", value: `${interaction.message.embeds[0].data.fields[secondedFieldIndex].value}, ${interaction.member.toString()}` });
		}
		const goalProgressFieldIndex = embed.data.fields?.findIndex(field => field.name === "Server Goal") ?? -1;
		if (goalProgressFieldIndex !== -1) {
			const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(interaction.guildId);
			if (goalId !== null) {
				embed.spliceFields(goalProgressFieldIndex, 1, { name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
			} else {
				embed.spliceFields(goalProgressFieldIndex, 1, { name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Complete!` });
			}
		}
		interaction.update({ embeds: [embed] });
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
		const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks);
		syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);
		const rankUpdates = formatSeasonResultsToRewardTexts(seasonUpdates, descendingRanks, await interaction.guild.roles.fetch());
		sendToRewardsThread(interaction.message, generateSecondingRewardString(interaction.member.displayName, recipientIds, rankUpdates, rewardTexts), "Rewards");
		const embeds = [];
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (company.scoreboardIsSeasonal) {
			embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, participationMap, descendingRanks, goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(company, interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), goalProgress));
		}
		updateScoreboard(company, interaction.guild, embeds);

		if (progressData.goalCompleted) {
			interaction.channel.send({
				embeds: [generateCompletionEmbed(progressData.contributorIds)]
			});
		}
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
