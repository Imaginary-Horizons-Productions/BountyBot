const { EmbedBuilder, MessageFlags } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { Op } = require('sequelize');
const { MAX_MESSAGE_CONTENT_LENGTH } = require('../constants');
const { getRankUpdates } = require('../util/scoreUtil');
const { timeConversion } = require('../util/textUtil');

const mainId = "secondtoast";
module.exports = new ButtonWrapper(mainId, 3000,
	/** Provide each recipient of a toast an extra XP, roll crit toast for author, and update embed */
	async (interaction, [toastId], database) => {
		const originalToast = await database.models.Toast.findByPk(toastId, { include: database.models.Toast.Recipients });
		if (originalToast.senderId === interaction.user.id) {
			interaction.reply({ content: "You cannot second your own toast.", ephemeral: true });
			return;
		}

		const secondReciept = await database.models.Seconding.findOne({ where: { toastId, seconderId: interaction.user.id } });
		if (secondReciept) {
			interaction.reply({ content: "You've already seconded this toast.", ephemeral: true });
			return;
		}

		await database.models.User.findOrCreate({ where: { id: interaction.user.id } });
		const [seconder] = await database.models.Hunter.findOrCreate({
			where: { userId: interaction.user.id, companyId: interaction.guildId }
		});
		seconder.toastSeconded++;

		const recipientIds = originalToast.Recipients.map(reciept => reciept.recipientId);
		recipientIds.push(originalToast.senderId);
		const levelTexts = [];
		for (const userId of recipientIds) {
			if (userId !== interaction.user.id) {
				const hunter = await database.models.Hunter.findOne({ where: { userId, companyId: interaction.guildId } });
				const levelText = await hunter.addXP(interaction.guild.name, 1, true, database);
				if (levelText) {
					levelTexts.push(levelText);
				}
				hunter.increment("toastsReceived");
			}
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
				recipientIds.push(interaction.user.id);
				const levelText = await seconder.addXP(interaction.guild.name, 1, true, database);
				if (levelText) {
					levelTexts.push(levelText);
				}
			}
		}

		database.models.Seconding.create({ toastId: originalToast.id, seconderId: interaction.user.id, wasCrit });
		seconder.save();

		const embed = new EmbedBuilder(interaction.message.embeds[0].data);
		if (interaction.message.embeds[0].data.fields?.length > 0) {
			embed.spliceFields(0, 1, { name: "Seconded by", value: `${interaction.message.embeds[0].data.fields[0].value}, ${interaction.member.toString()}` });
		} else {
			embed.addFields({ name: "Seconded by", value: interaction.member.toString() });
		}
		interaction.update({ embeds: [embed] });
		getRankUpdates(interaction.guild, database).then(rankUpdates => {
			let text = `__**XP Gained**__\n${recipientIds.map(id => `<@${id}> + 1 XP`).join("\n")}`;
			if (rankUpdates.length > 0) {
				text += `\n\n__**Rank Ups**__\n- ${rankUpdates.join("\n- ")}`;
			}
			if (levelTexts.length > 0) {
				text += `\n\n__**Rewards**__\n- ${levelTexts.join("\n- ")}`;
			}
			if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
				text = "Message overflow! Many people (?) probably gained many things (?). Use `/stats` to look things up.";
			}
			interaction.message.thread.send({ content: text, flags: MessageFlags.SuppressNotifications });
		})
	}
);
