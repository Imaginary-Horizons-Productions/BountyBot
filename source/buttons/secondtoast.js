const { EmbedBuilder } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { database } = require('../../database');
const { Op } = require('sequelize');
const { DAY_IN_MS } = require('../constants');
const { getRankUpdates } = require('../helpers');

const mainId = "secondtoast";
module.exports = new ButtonWrapper(mainId, 3000,
	/** Provide each recipient of a toast an extra XP, roll crit toast for author, and update embed */
	async (interaction, [toastId]) => {
		const originalToast = await database.models.Toast.findByPk(toastId, { include: database.models.Toast.ToastRecipients });
		if (originalToast.userId == interaction.user.id) {
			interaction.reply({ content: "You cannot second your own toast.", ephemeral: true });
			return;
		}

		const secondReciept = await database.models.ToastSeconding.findOne({ where: { toastId, seconderId: interaction.user.id } });
		if (secondReciept) {
			interaction.reply({ content: "You've already seconded this toast.", ephemeral: true });
			return;
		}

		const [seconder] = await database.models.Hunter.findOrCreate({
			where: { userId: interaction.user.id, companyId: interaction.guildId },
			defaults: { isRankEligible: interaction.member.manageable, User: { id: interaction.user.id } },
			include: database.models.Hunter.User //TODO #110 crashes if user already exists, but hunter doesn't
		});
		seconder.toastSeconded++;

		const recipientIds = originalToast.ToastRecipients.map(reciept => reciept.recipientId);
		recipientIds.push(originalToast.senderId);
		const levelTexts = [];
		for (const userId of recipientIds) {
			if (userId != interaction.user.id) {
				const hunter = await database.models.Hunter.findOne({ where: { userId, companyId: interaction.guildId } });
				levelTexts.concat(await hunter.addXP(interaction.guild, 1, true));
			}
		}

		const recentToasts = await database.models.ToastSeconding.findAll({ where: { seconderId: interaction.user.id, createdAt: { [Op.gt]: new Date(new Date() - 2 * DAY_IN_MS) } } });
		let critSecondsAvailable = 2;
		for (const seconding of recentToasts) {
			if (seconding.wasCrit) {
				critSecondsAvailable--;
				if (critSecondsAvailable < 1) {
					break;
				}
			}
		}

		const lastFiveToasts = await database.models.Toast.findAll({ where: { companyId: interaction.guildId, senderId: interaction.user.id }, include: database.models.Toast.ToastRecipients, order: [["createdAt", "DESC"]], limit: 5 });
		const staleToastees = lastFiveToasts.reduce((list, toast) => {
			return list.concat(toast.ToastRecipients.filter(reciept => reciept.isRewarded).map(recipient => recipient.userId));
		}, []);

		const wasCrit = false;
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
				levelTexts.concat(seconder.addXP(interaction.guild, 1, true));
			}
		}

		database.models.ToastSeconding.create({ toastId: originalToast.id, seconderId: interaction.user.id, wasCrit });
		seconder.save();

		const embed = new EmbedBuilder(interaction.message.embeds[0].data);
		if (interaction.message.embeds[0].data.fields?.length > 0) {
			embed.spliceFields(0, 1, { name: "Seconded by", value: `${interaction.message.embeds[0].data.fields[0].value}, ${interaction.member.toString()}` });
		} else {
			embed.addFields({ name: "Seconded by", value: interaction.member.toString() });
		}
		interaction.update({ embeds: [embed] });
		getRankUpdates(interaction.guild).then(rankUpdates => {
			let text = "";
			if (rankUpdates.length > 0) {
				text += `\n__**Rank Ups**__\n${rankUpdates.join("\n")}`;
			}
			text += `__**XP Gained**__\n${recipientIds.map(id => `<@${id}> + 1 XP`).join("\n")}${wasCrit ? `\n${interaction.member} + 1 XP` : ""}`;
			if (levelTexts.length > 0) {
				text += `\n__**Rewards**__\n${levelTexts.filter(text => Boolean(text)).join("\n")}`;
			}
			if (text.length > 2000) {
				text = "Message overflow! Many people (?) probably gained many things (?). Use `/stats` to look things up.";
			}
			interaction.message.thread.send(text);
		})
	}
);
