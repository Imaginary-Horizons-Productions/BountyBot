const { Guild, GuildMember } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { dateInPast } = require("../util/textUtil");
const { Company } = require("../models/companies/Company");
const { Hunter } = require("../models/users/Hunter");
const { Toast } = require("../models/toasts/Toast");
const { Recipient } = require("../models/toasts/Recipient");

/** @type {Sequelize} */
let db;

function setDB(database) {
	db = database;
}

/** *Find the Secondings of specified seconder for the purposes of Crit Toast and Rewarded Toast tracking*
 * @param {string} seconderId
 */
function findRecentSecondings(seconderId) {
	return db.models.Seconding.findAll({ where: { seconderId, createdAt: { [Op.gt]: dateInPast({ d: 2 }) } } });
}

/** *Get the ids of the rewarded Recipients on the sender's last 5 Toasts*
 *
 * Duplicated stale toastee ids are intended as a way of recording accumulating staleness
 * @param {string} senderId
 * @param {string} companyId
 */
async function findStaleToasteeIds(senderId, companyId) {
	const lastFiveToasts = await db.models.Toast.findAll({ where: { senderId, companyId }, include: db.models.Toast.Recipients, order: [["createdAt", "DESC"]], limit: 5 });
	return lastFiveToasts.reduce((list, toast) => {
		return list.concat(toast.Recipients.filter(reciept => reciept.isRewarded).map(reciept => reciept.recipientId));
	}, []);
}

/** *Create a Seconding entity*
 * @param {string} toastId
 * @param {string} seconderId
 * @param {boolean} wasCrit
 */
function createSeconding(toastId, seconderId, wasCrit) {
	return db.models.Seconding.create({ toastId, seconderId, wasCrit });
}

/** *Find a specified Hunter's most seconded Toast*
 * @param {string} senderId
 * @param {string} companyId
 */
function findMostSecondedToast(senderId, companyId) {
	return db.models.Toast.findOne({ where: { senderId, companyId, secondings: { [Op.gt]: 0 } }, order: [["secondings", "DESC"]] });
}

/** *Checks if the specified seconder has already seconded the specified Toast*
 * @param {string} toastId
 * @param {string} seconderId
 */
async function wasAlreadySeconded(toastId, seconderId) {
	return Boolean(await db.models.Seconding.findOne({ where: { toastId, seconderId } }));
}

/** *Find the specified Toast*
 * @param {string} toastId
 * @returns {Promise<Toast & {Recipients: Recipient[]}>}
 */
function findToastByPK(toastId) {
	return db.models.Toast.findByPk(toastId, { include: db.models.Toast.Recipients });
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
	const allHunters = await db.models.Hunters.findAll({ where: { companyId: company.id } });
	const previousCompanyLevel = company.getLevel(allHunters);
	// Make database entities
	const recentToasts = await db.models.Toast.findAll({ where: { companyId: guild.id, senderId: sender.id, createdAt: { [Op.gt]: dateInPast({ d: 2 }) } }, include: db.models.Toast.Recipients });
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
	const toastsInLastDay = recentToasts.filter(toast => new Date(toast.createdAt) > dateInPast({ d: 1 }));
	const hunterIdsToastedInLastDay = toastsInLastDay.reduce((idSet, toast) => {
		toast.Recipients.forEach(reciept => {
			if (!idSet.has(reciept.recipientId)) {
				idSet.add(reciept.recipientId);
			}
		})
		return idSet;
	}, new Set());

	const staleToastees = await findStaleToasteeIds(sender.id, guild.id);

	const rewardTexts = [];
	const toast = await db.models.Toast.create({ companyId: guild.id, senderId: sender.id, text: toastText, imageURL });
	const rawRecipients = [];
	const rewardedHunterIds = [];
	let critValue = 0;
	const startingSenderLevel = senderHunter.getLevel(company.xpCoefficient);
	for (const id of toasteeIds) {
		const rawToast = { toastId: toast.id, recipientId: id, isRewarded: !hunterIdsToastedInLastDay.has(id) && rewardsAvailable > 0, wasCrit: false };
		if (rawToast.isRewarded) {
			await db.models.User.findOrCreate({ where: { id } });
			const [hunter] = await db.models.Hunter.findOrCreate({ where: { userId: id, companyId: company.id } });
			rewardedHunterIds.push(hunter.userId);
			const previousHunterLevel = hunter.getLevel(company.xpCoefficient);
			await hunter.increment({ toastsReceived: 1, xp: 1 }).then(hunter => hunter.reload());
			const hunterLevelLine = hunter.buildLevelUpLine(previousHunterLevel, company.xpCoefficient, company.maxSimBounties);
			if (hunterLevelLine) {
				rewardTexts.push(hunterLevelLine);
			}
			const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: guild.id, userId: hunter.userId, seasonId }, defaults: { xp: 1 } });
			if (!participationCreated) {
				participation.increment("xp");
			}

			// Calculate crit
			if (critToastsAvailable > 0) {
				const critRoll = Math.random() * 100;

				let effectiveToastLevel = startingSenderLevel + 2;
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

	// Update sender
	const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: guild.id, userId: sender.id, seasonId }, defaults: { xp: critValue, toastsRaised: 1 } });
	if (critValue > 0) {
		const previousSenderLevel = senderHunter.getLevel(company.xpCoefficient);
		await senderHunter.increment({ toastsRaised: 1, xp: critValue }).then(senderHunter => senderHunter.reload());
		const senderLevelLine = senderHunter.buildLevelUpLine(previousSenderLevel, company.xpCoefficient, company.maxSimBounties);
		if (senderLevelLine) {
			rewardTexts.push(senderLevelLine);
		}
		if (!participationCreated) {
			participation.increment({ xp: critValue, toastsRaised: 1 });
		}
	} else {
		senderHunter.increment("toastsRaised");
		participation.increment("toastsRaised");
	}

	const companyLevelLine = company.buildLevelUpLine(previousCompanyLevel, allHunters, guild.name);
	if (companyLevelLine) {
		rewardTexts.push(companyLevelLine);
	}

	return { toastId: toast.id, rewardedHunterIds, rewardTexts, critValue };
}

/** *Deletes all Toasts, Recipients, and Secondings for a specified Company*
 * @param {string} companyId
 */
function deleteCompanyToasts(companyId) {
	return db.models.Toast.findAll({ where: { companyId } }).then(toasts => {
		toasts.forEach(toast => {
			db.models.Recipient.destroy({ where: { toastId: toast.id } });
			db.models.Seconding.destroy({ where: { toastId: toast.id } });
			toast.destroy();
		})
	});
}

module.exports = {
	setDB,
	findRecentSecondings,
	findStaleToasteeIds,
	createSeconding,
	findMostSecondedToast,
	wasAlreadySeconded,
	findToastByPK,
	raiseToast,
	deleteCompanyToasts
}
