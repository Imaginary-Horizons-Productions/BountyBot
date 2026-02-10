const { MessageFlags } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { refreshReferenceChannelScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, goalCompletionEmbed, sendRewardMessage, syncRankRoles, rewardSummary, consolidateHunterReceipts, toastEmbed } = require('../shared');
const { Company } = require('../../database/models');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "secondtoast";
module.exports = new ButtonWrapper(mainId, 3000,
	/** Provide each recipient of a toast an extra XP, roll crit toast for author, and update embed */
	async (interaction, origin, runMode, [toastId]) => {
		const originalToast = await logicLayer.toasts.findToastByPK(toastId);
		if (!originalToast) {
			interaction.reply({ content: "Database record of this toast could not be found.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (runMode === "production" && originalToast.senderId === interaction.user.id) {
			interaction.reply({ content: "You cannot second your own toast.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (await logicLayer.toasts.wasAlreadySeconded(toastId, interaction.user.id)) {
			interaction.reply({ content: "You've already seconded this toast.", flags: MessageFlags.Ephemeral });
			return;
		}

		await origin.hunter.increment("toastsSeconded");
		await originalToast.increment("secondings");
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
		const progressData = await logicLayer.goals.progressGoal(interaction.guildId, "secondings", origin.hunter, season);
		const companyReceipt = { guildName: interaction.guild.name };
		if (progressData.gpContributed > 0) {
			companyReceipt.gpExpression = progressData.gpContributed.toString();
		}

		const recipientIds = [];
		originalToast.Recipients.forEach(reciept => {
			if (reciept.recipientId !== interaction.user.id) {
				recipientIds.push(reciept.recipientId);
			}
		});
		const hunterReceipts = new Map();

		const previousCompanyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id)));
		const xpMultiplierString = origin.company.festivalMultiplierString();
		for (const userId of recipientIds) {
			const hunterReceipt = {};
			await logicLayer.seasons.changeSeasonXP(userId, interaction.guildId, season.id, 1);
			let hunter = await logicLayer.hunters.findOneHunter(userId, interaction.guild.id);
			const previousLevel = hunter.getLevel(origin.company.xpCoefficient);
			hunter = await hunter.increment({ toastsReceived: 1, xp: 1 }).then(hunter => hunter.reload());
			hunterReceipt.xp = 1;
			hunterReceipt.xpMultiplier = xpMultiplierString;
			const currentLevel = hunter.getLevel(origin.company.xpCoefficient);
			if (currentLevel > previousLevel) {
				hunterReceipt.levelUp = { achievedLevel: currentLevel, previousLevel };
			}
			hunterReceipts.set(userId, hunterReceipt);
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
		const startingSeconderLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
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
		const currentCompanyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id)));
		if (previousCompanyLevel < currentCompanyLevel) {
			companyReceipt.levelUp = currentCompanyLevel;
		}

		await logicLayer.toasts.createSeconding(originalToast.id, interaction.user.id, critSeconds > 0);
		if (critSeconds > 0) {
			const hunterReceipt = { title: "Critical Toast!", xp: critSeconds };
			const previousSenderLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
			await origin.hunter.increment({ xp: critSeconds }).then(seconder => seconder.reload());
			const currentSenderLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
			if (currentSenderLevel > previousSenderLevel) {
				hunterReceipt.levelUp = { achievedLevel: currentSenderLevel, previousLevel: previousSenderLevel };
			}
			hunterReceipts.set(interaction.user.id, hunterReceipt);
			await logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, critSeconds);
		}

		interaction.update({ embeds: [toastEmbed(origin.company.toastThumbnailURL, originalToast.text, recipientIds, interaction.member, progressData, originalToast.imageURL, await logicLayer.toasts.findSecondingMentions(originalToast.id))] });
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await interaction.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
		consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
		sendRewardMessage(interaction.message, `${interaction.member.displayName} seconded this toast!\n${rewardSummary("seconding", companyReceipt, hunterReceipts, origin.company.maxSimBounties)}`, "Rewards");
		const embeds = [];
		if (origin.company.scoreboardIsSeasonal) {
			embeds.push(await seasonalScoreboardEmbed(origin.company, interaction.guild, participationMap, descendingRanks, progressData));
		} else {
			embeds.push(await overallScoreboardEmbed(origin.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id), progressData));
		}
		refreshReferenceChannelScoreboard(origin.company, interaction.guild, embeds);

		if (progressData.goalCompleted) {
			interaction.channel.send({
				embeds: [goalCompletionEmbed(progressData.contributorIds)]
			});
		}
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
