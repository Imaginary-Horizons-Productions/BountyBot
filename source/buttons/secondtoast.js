const { EmbedBuilder, MessageFlags, userMention } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { Op } = require('sequelize');
const { MAX_MESSAGE_CONTENT_LENGTH } = require('../constants');
const { getRankUpdates } = require('../util/scoreUtil');
const { timeConversion, commandMention, congratulationBuilder, listifyEN, generateTextBar } = require('../util/textUtil');
const { updateScoreboard } = require('../util/embedUtil');
const { progressGoal } = require('../logic/goals');

const mainId = "secondtoast";
module.exports = new ButtonWrapper(mainId, 3000,
	/** Provide each recipient of a toast an extra XP, roll crit toast for author, and update embed */
	async (interaction, [toastId], database, runMode) => {
		await database.models.User.findOrCreate({ where: { id: interaction.user.id } });
		const [seconder] = await database.models.Hunter.findOrCreate({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
		if (seconder.isBanned) {
			interaction.reply({ content: `You are banned from interacting with BountyBot on ${interaction.guild.name}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const originalToast = await database.models.Toast.findByPk(toastId, { include: database.models.Toast.Recipients });
		if (runMode === "prod" && originalToast.senderId === interaction.user.id) {
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
		const progressData = await progressGoal(interaction.guildId, "secondings", interaction.user.id, database);
		const rewardTexts = [`This seconding contributed ${progressData.gpContributed} GP to the Server Goal!`];

		const recipientIds = [];
		originalToast.Recipients.forEach(reciept => {
			if (reciept.recipientId !== interaction.user.id) {
				recipientIds.push(reciept.recipientId);
			}
		});
		const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
		for (const userId of recipientIds) {
			const hunter = await database.models.Hunter.findOne({ where: { userId, companyId: interaction.guildId } });
			const recipientLevelTexts = await hunter.addXP(interaction.guild.name, 1, true, database);
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
				const seconderLevelTexts = await seconder.addXP(interaction.guild.name, 1, true, database);
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
		const secondedFieldIndex = embed.data.fields?.findIndex(field => field.name === "Seconded by");
		if (secondedFieldIndex === -1) {
			embed.addFields({ name: "Seconded by", value: interaction.member.toString() });
		} else {
			embed.spliceFields(secondedFieldIndex, 1, { name: "Seconded by", value: `${interaction.message.embeds[0].data.fields[secondedFieldIndex].value}, ${interaction.member.toString()}` });
		}
		const goalProgressFieldIndex = embed.data.fields?.findIndex(field => field.name === "Server Goal");
		if (goalProgressFieldIndex !== -1) {
			const goal = await database.models.Goal.findOne({ where: { companyId: interaction.guildId, state: "ongoing" } });
			const progress = await database.models.Contribution.sum("value", { where: { goalId: goal.id } }) ?? 0;
			embed.spliceFields(goalProgressFieldIndex, 1, { name: "Server Goal", value: `${generateTextBar(progress, goal.requiredContributions, 15)} ${Math.min(progress, goal.requiredContributions)}/${goal.requiredContributions} GP` });
		}
		interaction.update({ embeds: [embed] });
		getRankUpdates(interaction.guild, database).then(async rankUpdates => {
			let text = `${interaction.member.displayName} seconded this toast!\n__**XP Gained**__\n${recipientIds.map(id => `<@${id}> + 1 XP${id === interaction.user.id ? " *Critical Toast!*" : ""}`).join("\n")}`;
			if (rankUpdates.length > 0) {
				text += `\n\n__**Rank Ups**__\n- ${rankUpdates.join("\n- ")}`;
			}
			if (rewardTexts.length > 0) {
				text += `\n\n__**Rewards**__\n- ${rewardTexts.join("\n- ")}`;
			}
			if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
				text = `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
			}
			if (interaction.channel.isThread()) {
				interaction.channel.send({ content: text, flags: MessageFlags.SuppressNotifications });
			} else if (interaction.message.thread !== null) {
				interaction.message.thread.send({ content: text, flags: MessageFlags.SuppressNotifications });
			} else {
				interaction.message.startThread({ name: "Rewards" }).then(thread => {
					thread.send({ content: text, flags: MessageFlags.SuppressNotifications });
				})
			}
			updateScoreboard(await database.models.Company.findByPk(interaction.guildId), interaction.guild, database);
		})

		if (progressData.goalCompleted) {
			interaction.channel.send({
				embeds: [
					new EmbedBuilder().setColor("e5b271")
						.setTitle("Server Goal Completed")
						.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
						.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
						.addFields({ name: "Contributors", value: listifyEN(progressData.contributorIds.map(id => userMention(id))) })
				]
			});
		}
	}
);
