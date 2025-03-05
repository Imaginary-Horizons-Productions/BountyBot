const { Guild, GuildMember } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { timeConversion } = require("../util/textUtil");
const { Company } = require("../models/companies/Company");
const { Hunter } = require("../models/users/Hunter");

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
 * @param {string} seasonId
 * @param {string} toastText
 * @param {string | null} imageURL
 */
async function raiseToast(guild, company, sender, senderHunter, toasteeIds, seasonId, toastText, imageURL = null) {
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

	const rewardTexts = [];
	senderHunter.increment("toastsRaised");
	const toast = await db.models.Toast.create({ companyId: guild.id, senderId: sender.id, text: toastText, imageURL });
	const rawRecipients = [];
	const rewardedHunterIds = [];
	let critValue = 0;
	for (const id of toasteeIds) {
		const rawToast = { toastId: toast.id, recipientId: id, isRewarded: !hunterIdsToastedInLastDay.has(id) && rewardsAvailable > 0, wasCrit: false };
		if (rawToast.isRewarded) {
			await db.models.User.findOrCreate({ where: { id } });
			const [hunter] = await db.models.Hunter.findOrCreate({ where: { userId: id, companyId: company.id } });
			rewardedHunterIds.push(hunter.userId);
			rewardTexts.push(...await hunter.addXP(guild.name, 1, false, company));
			const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: guild.id, userId: hunter.userId, seasonId }, defaults: { xp: 1 } });
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
	rewardTexts.push(...await senderHunter.addXP(guild.name, critValue, false, company));
	const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: guild.id, userId: sender.id, seasonId }, defaults: { xp: critValue, toastsRaised: 1 } });
	if (!participationCreated) {
		participation.increment({ xp: critValue, toastsRaised: 1 });
	}

	return { toastId: toast.id, rewardedHunterIds, rewardTexts, critValue };
}

module.exports = {
	setDB,
	raiseToast
}
