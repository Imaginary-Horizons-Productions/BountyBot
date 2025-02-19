const { EmbedBuilder, userMention, Guild, GuildMember } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { timeConversion, listifyEN, congratulationBuilder, generateTextBar } = require("../util/textUtil");
const { progressGoal, findLatestGoalProgress } = require("./goals");
const { Company } = require("../models/companies/Company");
const { Hunter } = require("../models/users/Hunter");
const { findOrCreateBountyHunter } = require("./hunters");

/** @type {Sequelize} */
let db;

function setDB(database) {
	db = database;
}

/**
 * @param {Guild} guild
 * @param {Company} company
 * @param {GuildMember} sender
 * @param {Hunter} senderHunter
 * @param {string[]} toasteeIds
 * @param {string} toastText
 * @param {string | null} imageURL
 */
async function raiseToast(guild, company, sender, senderHunter, toasteeIds, toastText, imageURL = null) {
	const embeds = [
		new EmbedBuilder().setColor("e5b271")
			.setThumbnail(company.toastThumbnailURL ?? 'https://cdn.discordapp.com/attachments/545684759276421120/751876927723143178/glass-celebration.png')
			.setTitle(toastText)
			.setDescription(`A toast to ${listifyEN(toasteeIds.map(id => userMention(id)))}!`)
			.setFooter({ text: sender.displayName, iconURL: sender.user.avatarURL() })
	];
	if (imageURL) {
		embeds[0].setImage(imageURL);
	}

	// Make database entities
	const recentToasts = await db.models.Toast.findAll({ where: { companyId: guild.id, senderId: sender.id, createdAt: { [Op.gt]: new Date(new Date() - 2 * timeConversion(1, "d", "ms")) } }, include: db.models.Toast.Recipients });
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

	const lastFiveToasts = await db.models.Toast.findAll({ where: { companyId: guild.id, senderId: sender.id }, include: db.models.Toast.Recipients, order: [["createdAt", "DESC"]], limit: 5 });
	const staleToastees = lastFiveToasts.reduce((list, toast) => {
		return list.concat(toast.Recipients.filter(reciept => reciept.isRewarded).map(reciept => reciept.recipientId));
	}, []);

	const [season] = await db.models.Season.findOrCreate({ where: { companyId: guild.id, isCurrentSeason: true } });
	season.increment("toastsRaised");

	const rewardTexts = [];
	if (rewardsAvailable > 0) {
		const progressData = await progressGoal(guild.id, "toasts", sender.id);
		if (progressData.gpContributed > 0) {
			rewardTexts.push(`This toast contributed ${progressData.gpContributed} GP to the Server Goal!`);
			if (progressData.goalCompleted) {
				embeds.push(new EmbedBuilder().setColor("e5b271")
					.setTitle("Server Goal Completed")
					.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
					.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
					.addFields({ name: "Contributors", value: listifyEN(progressData.contributorIds.map(id => userMention(id))) })
				);
			}
			const { goalId, currentGP, requiredGP } = await findLatestGoalProgress(guild.id);
			if (goalId !== null) {
				embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${Math.min(currentGP, requiredGP)}/${requiredGP} GP` });
			} else {
				embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
			}
		}
	}
	senderHunter.increment("toastsRaised");
	const toast = await db.models.Toast.create({ companyId: guild.id, senderId: sender.id, text: toastText, imageURL });
	const rawRecipients = [];
	const rewardedHunterIds = [];
	let critValue = 0;
	for (const id of toasteeIds) {
		const rawToast = { toastId: toast.id, recipientId: id, isRewarded: !hunterIdsToastedInLastDay.has(id) && rewardsAvailable > 0, wasCrit: false };
		if (rawToast.isRewarded) {
			const [hunter] = await findOrCreateBountyHunter(id, company.id);
			rewardedHunterIds.push(hunter.userId);
			rewardTexts.push(...await hunter.addXP(guild.name, 1, false, db));
			const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: guild.id, userId: hunter.userId, seasonId: season.id }, defaults: { xp: 1 } });
			if (!participationCreated) {
				participation.increment("xp");
			}
			hunter.increment("toastsReceived");

			// Calculate crit
			if (critToastsAvailable > 0) {
				const critRoll = Math.random() * 100;

				let effectiveToastLevel = senderHunter.level + 2;
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
	db.models.Recipient.bulkCreate(rawRecipients);

	// Add XP and update ranks
	rewardTexts.push(...await senderHunter.addXP(guild.name, critValue, false, db));
	const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: guild.id, userId: sender.id, seasonId: season.id }, defaults: { xp: critValue, toastsRaised: 1 } });
	if (!participationCreated) {
		participation.increment({ xp: critValue, toastsRaised: 1 });
	}

	return { toastId: toast.id, rewardedHunterIds, rewardTexts, critValue, embeds };
}

module.exports = {
	setDB,
	raiseToast
}
