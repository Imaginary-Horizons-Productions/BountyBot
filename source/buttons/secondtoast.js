const { EmbedBuilder, MessageFlags } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { Op } = require('sequelize');
const { getRankUpdates } = require('../util/scoreUtil');
const { timeConversion, generateTextBar } = require('../util/textUtil');
const { updateScoreboard } = require('../util/embedUtil');
const { Seconding } = require('../models/toasts/Seconding');
const { Goal } = require('../models/companies/Goal');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "secondtoast";
module.exports = new ButtonWrapper(mainId, 3000,
	/** Provide each recipient of a toast an extra XP, roll crit toast for author, and update embed */
	async (interaction, [toastId], database, runMode) => {
		const [seconder] = await logicLayer.hunters.findOrCreateBountyHunter(interaction.user.id, interaction.guild.id);
		if (seconder.isBanned) {
			interaction.reply({ content: `You are banned from interacting with BountyBot on ${interaction.guild.name}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const originalToast = await database.models.Toast.findByPk(toastId, { include: database.models.Toast.Recipients });
		if (runMode === "production" && originalToast.senderId === interaction.user.id) {
			interaction.reply({ content: "You cannot second your own toast.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const secondReciept = await database.models.Seconding.findOne({ where: { toastId, seconderId: interaction.user.id } });
		if (secondReciept) {
			interaction.reply({ content: "You've already seconded this toast.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		seconder.increment("toastsSeconded");
		originalToast.increment("secondings");
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
		const progressData = await logicLayer.goals.progressGoal(interaction.guildId, "secondings", seconder, season);
		const rewardTexts = [`This seconding contributed ${progressData.gpContributed} GP to the Server Goal!`];

		const recipientIds = [];
		originalToast.Recipients.forEach(reciept => {
			if (reciept.recipientId !== interaction.user.id) {
				recipientIds.push(reciept.recipientId);
			}
		});
		const company = await logicLayer.companies.findCompanyByPK(interaction.guild.id);
		for (const userId of recipientIds) {
			const hunter = await logicLayer.hunters.findOneHunter(userId, interaction.guild.id);
			const recipientLevelTexts = await hunter.addXP(interaction.guild.name, 1, true, company);
			const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: interaction.guildId, userId, seasonId: season.id }, defaults: { xp: 1 } });
			if (!participationCreated) {
				participation.increment({ xp: 1 });
			}
			if (recipientLevelTexts.length > 0) {
				rewardTexts.push(...recipientLevelTexts);
			}
			hunter.increment("toastsReceived");
		}

		const recentToasts = await database.models.Seconding.findAll({ where: { seconderId: interaction.user.id, createdAt: { [Op.gt]: new Date(new Date() - 2 * timeConversion(1, "d", "ms")) } } });
		let critSecondsAvailable = 2;
		for (const seconding of recentToasts) {
			if (seconding.wasCrit) {
				critSecondsAvailable--;
				if (critSecondsAvailable < 1) {
					break;
				}
			}
		}

		const lastFiveToasts = await database.models.Toast.findAll({ where: { companyId: interaction.guildId, senderId: interaction.user.id }, include: database.models.Toast.Recipients, order: [["createdAt", "DESC"]], limit: 5 });
		const staleToastees = lastFiveToasts.reduce((list, toast) => {
			return list.concat(toast.Recipients.filter(reciept => reciept.isRewarded).map(recipient => recipient.userId));
		}, []);

		let wasCrit = false;
		if (critSecondsAvailable > 0) {
			let lowestEffectiveToastLevel = seconder.level + 2;
			for (const userId of recipientIds) {
				// Calculate crit
				let effectiveToastLevel = seconder.level + 2;
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
				wasCrit = true;
				recipientIds.push(interaction.user.id);
				const seconderLevelTexts = await seconder.addXP(interaction.guild.name, 1, true, company);
				if (seconderLevelTexts.length > 0) {
					rewardTexts = rewardTexts.concat(seconderLevelTexts);
				}
				const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: interaction.guildId, userId: interaction.user.id, seasonId: season.id }, defaults: { xp: 1 } });
				if (!participationCreated) {
					participation.increment({ xp: 1 });
				}
			}
		}

		database.models.Seconding.create({ toastId: originalToast.id, seconderId: interaction.user.id, wasCrit });

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
				embed.spliceFields(goalProgressFieldIndex, 1, { name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${Math.min(currentGP, requiredGP)}/${requiredGP} GP` });
			} else {
				embed.spliceFields(goalProgressFieldIndex, 1, { name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Complete!` });
			}
		}
		interaction.update({ embeds: [embed] });
		getRankUpdates(interaction.guild, database, logicLayer).then(async rankUpdates => {
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
			updateScoreboard(interaction.guild, database, logicLayer);
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
