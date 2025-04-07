const { EmbedBuilder, MessageFlags } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { getRankUpdates } = require('../util/scoreUtil');
const { generateTextBar } = require('../util/textUtil');
const { Seconding } = require('../models/toasts/Seconding');
const { Goal } = require('../models/companies/Goal');
const { Hunter } = require('../models/users/Hunter');
const { Company } = require('../models/companies/Company');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "secondtoast";
module.exports = new ButtonWrapper(mainId, 3000,
	/** Provide each recipient of a toast an extra XP, roll crit toast for author, and update embed */
	async (interaction, runMode, [toastId]) => {
		const [seconder] = await logicLayer.hunters.findOrCreateBountyHunter(interaction.user.id, interaction.guild.id);
		if (seconder.isBanned) {
			interaction.reply({ content: `You are banned from interacting with BountyBot on ${interaction.guild.name}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const originalToast = await logicLayer.toasts.findToastByPK(toastId);
		if (runMode === "production" && originalToast.senderId === interaction.user.id) {
			interaction.reply({ content: "You cannot second your own toast.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		if (await logicLayer.toasts.wasAlreadySeconded(toastId, interaction.user.id)) {
			interaction.reply({ content: "You've already seconded this toast.", flags: [MessageFlags.Ephemeral] });
			return;
		}

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
			hunter.increment({ toastsReceived: 1, xp: 1 });
			const hunterLevelLine = Hunter.buildLevelUpLine(previousLevel, hunter.getLevel(company.xpCoefficient), userId);
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
		const companyLevelLine = Company.buildLevelUpLine(previousCompanyLevel, company.getLevel(await logicLayer.hunters.findCompanyHunters(interaction.guild.id)), interaction.guild.name);
		if (companyLevelLine) {
			rewardTexts.push(companyLevelLine);
		}

		logicLayer.toasts.createSeconding(originalToast.id, interaction.user.id, critSeconds > 0);
		if (critSeconds > 0) {
			seconder.increment({ xp: critSeconds });
			const hunterLevelLine = Hunter.buildLevelUpLine(startingSeconderLevel, seconder.getLevel(company.xpCoefficient), interaction.user.id);
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
		getRankUpdates(interaction.guild, logicLayer).then(async rankUpdates => {
			const content = Seconding.generateRewardString(interaction.member.displayName, recipientIds, rankUpdates, rewardTexts);
			if (interaction.channel.isThread()) {
				interaction.channel.send({ content, flags: MessageFlags.SuppressNotifications });
			} else if (interaction.message.thread !== null) {
				interaction.message.thread.send({ content, flags: MessageFlags.SuppressNotifications });
			} else {
				interaction.message.startThread({ name: "Rewards" }).then(thread => {
					thread.send({ content, flags: MessageFlags.SuppressNotifications });
				})
			}
			company.updateScoreboard(interaction.guild, logicLayer);
		})

		if (progressData.goalCompleted) {
			interaction.channel.send({
				embeds: [Goal.generateCompletionEmbed(progressData.contributorIds)]
			});
		}
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
