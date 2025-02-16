const { EmbedBuilder, userMention, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { timeConversion, commandMention, listifyEN, congratulationBuilder, generateTextBar } = require("../util/textUtil");
const { SAFE_DELIMITER, MAX_MESSAGE_CONTENT_LENGTH } = require("../constants");
const { getRankUpdates } = require("../util/scoreUtil");
const { updateScoreboard } = require("../util/embedUtil");
const { progressGoal, findLatestGoalProgress } = require("./goals");

/**
 * @param {import("discord.js").Interaction} interaction note this is the interaction that is awaiting a reply, not necessarily the interaction named "interaction" in the controller
 * @param {Sequelize} database
 * @param {string[]} toasteeIds
 * @param {string} toastText
 * @param {string | null} imageURL
 */
async function raiseToast(interaction, database, toasteeIds, toastText, imageURL = null) {
	const [company] = await database.models.Company.findOrCreate({ where: { id: interaction.guildId } });
	const embeds = [
		new EmbedBuilder().setColor("e5b271")
			.setThumbnail(company.toastThumbnailURL ?? 'https://cdn.discordapp.com/attachments/545684759276421120/751876927723143178/glass-celebration.png')
			.setTitle(toastText)
			.setDescription(`A toast to ${listifyEN(toasteeIds.map(id => userMention(id)))}!`)
			.setFooter({ text: interaction.member.displayName, iconURL: interaction.user.avatarURL() })
	];
	if (imageURL) {
		embeds[0].setImage(imageURL);
	}

	// Make database entities
	const recentToasts = await database.models.Toast.findAll({ where: { companyId: interaction.guildId, senderId: interaction.user.id, createdAt: { [Op.gt]: new Date(new Date() - 2 * timeConversion(1, "d", "ms")) } }, include: database.models.Toast.Recipients });
	let rewardsAvailable = 10;
	let critToastsAvailable = 2;
	for (const toast of recentToasts) {
		for (const reciept of toast.Recipients) {
			if (reciept.isRewarded) {
				rewardsAvailable--;
			}
			if (reciept.wasCrit) {
				critToastsAvailable--;
			}
		}
	}
	const toastsInLastDay = recentToasts.filter(toast => new Date(toast.createdAt) > new Date(new Date() - timeConversion(1, "d", "ms")));
	const hunterIdsToastedInLastDay = toastsInLastDay.reduce((idSet, toast) => {
		toast.Recipients.forEach(reciept => {
			if (!idSet.has(reciept.recipientId)) {
				idSet.add(reciept.recipientId);
			}
		})
		return idSet;
	}, new Set());

	const lastFiveToasts = await database.models.Toast.findAll({ where: { companyId: interaction.guildId, senderId: interaction.user.id }, include: database.models.Toast.Recipients, order: [["createdAt", "DESC"]], limit: 5 });
	const staleToastees = lastFiveToasts.reduce((list, toast) => {
		return list.concat(toast.Recipients.filter(reciept => reciept.isRewarded).map(reciept => reciept.recipientId));
	}, []);

	const rawRecipients = [];
	const rewardedRecipients = [];
	let critValue = 0;
	const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
	season.increment("toastsRaised");

	let rewardTexts = [];
	if (rewardsAvailable > 0) {
		const progressData = await progressGoal(interaction.guildId, "toasts", interaction.user.id);
		rewardTexts.push(`This toast contributed ${progressData.gpContributed} GP to the Server Goal!`);
		if (progressData.goalCompleted) {
			embeds.push(new EmbedBuilder().setColor("e5b271")
				.setTitle("Server Goal Completed")
				.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
				.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
				.addFields({ name: "Contributors", value: listifyEN(progressData.contributorIds.map(id => userMention(id))) })
			);
		}
		if (progressData.gpContributed > 0) {
			const { currentGP, requiredGP } = await findLatestGoalProgress(interaction.guildId);
			embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${Math.min(currentGP, requiredGP)}/${requiredGP} GP` });
		}
	}
	await database.models.User.findOrCreate({ where: { id: interaction.user.id } });
	const [sender] = await database.models.Hunter.findOrCreate({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
	sender.increment("toastsRaised");
	const toast = await database.models.Toast.create({ companyId: interaction.guildId, senderId: interaction.user.id, text: toastText, imageURL });
	for (const id of toasteeIds) {
		//TODO #97 move to bulkCreate after finding solution to create by association only if user doesn't already exist
		await database.models.User.findOrCreate({ where: { id } });
		const rawToast = { toastId: toast.id, recipientId: id, isRewarded: !hunterIdsToastedInLastDay.has(id) && rewardsAvailable > 0, wasCrit: false };
		if (rawToast.isRewarded) {
			rewardedRecipients.push(id);

			// Calculate crit
			if (critToastsAvailable > 0) {
				const critRoll = Math.random() * 100;

				let effectiveToastLevel = sender.level + 2;
				for (const recipientId of staleToastees) {
					if (id == recipientId) {
						effectiveToastLevel--;
						if (effectiveToastLevel < 2) {
							break;
						}
					}
				};

				/* f(x) > 150/(x+2)^(1/3)
				where:
				  f(x) = critRoll
				  x + 2 = effectiveToastLevel
				  150^3 = 3375000

				notes:
				- cubing both sides of the equation avoids the third root operation and prebakes the constant exponentiation
				- constants set arbitrarily by user experience design
				*/
				if (critRoll * critRoll * critRoll > 3375000 / effectiveToastLevel) {
					rawToast.wasCrit = true;
					critValue += 1;
					critToastsAvailable--;
				}
			}

			rewardsAvailable--;
		}
		rawRecipients.push(rawToast);
	}
	database.models.Recipient.bulkCreate(rawRecipients);

	// Add XP and update ranks
	const toasterLevelTexts = await sender.addXP(interaction.guild.name, critValue, false, database);
	const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: interaction.guildId, userId: interaction.user.id, seasonId: season.id }, defaults: { xp: critValue, toastsRaised: 1 } });
	if (!participationCreated) {
		participation.increment({ xp: critValue, toastsRaised: 1 });
	}
	if (toasterLevelTexts.length > 0) {
		rewardTexts.push(...toasterLevelTexts);
	}
	for (const recipientId of rewardedRecipients) {
		const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: recipientId, companyId: interaction.guildId } });
		const toasteeLevelTexts = await hunter.addXP(interaction.guild.name, 1, false, database);
		const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: interaction.guildId, userId: hunter.userId, seasonId: season.id }, defaults: { xp: 1 } });
		if (!participationCreated) {
			participation.increment("xp");
		}
		if (toasteeLevelTexts.length > 0) {
			rewardTexts = rewardTexts.concat(toasteeLevelTexts);
		}
		hunter.increment("toastsReceived");
	}

	interaction.reply({
		embeds,
		components: [
			new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId(`secondtoast${SAFE_DELIMITER}${toast.id}`)
					.setLabel("Hear, hear!")
					.setEmoji("🥂")
					.setStyle(ButtonStyle.Primary)
			)
		],
		withResponse: true
	}).then(response => {
		if (rewardedRecipients.length > 0) {
			getRankUpdates(interaction.guild, database).then(rankUpdates => {
				const multiplierString = company.festivalMultiplierString();
				let text = `__**XP Gained**__\n${rewardedRecipients.map(id => `<@${id}> + 1 XP${multiplierString}`).join("\n")}${critValue > 0 ? `\n${interaction.member} + ${critValue} XP${multiplierString} *Critical Toast!*` : ""}`;
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
				} else {
					response.resource.message.startThread({ name: "Rewards" }).then(thread => {
						thread.send({ content: text, flags: MessageFlags.SuppressNotifications });
					})
				}
				updateScoreboard(company, interaction.guild, database);
			});
		}
	});
}

module.exports = {
	raiseToast
}
