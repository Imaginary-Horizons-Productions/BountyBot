const { Guild } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { dateInPast } = require("../shared");
const { Company, Hunter, Toast, Recipient } = require("../database/models");

/** @type {Sequelize} */
let db;

function setDB(database) {
	db = database;
}

/** *Find the Secondings of specified seconder for the purposes of Crit Toast and Rewarded Toast tracking*
 * @param {string} seconderId
 * @param {object} recency How far in the past to look for recent secondings. By default, 2 days.
 * @param {number} recency.w An amount of time to look back in weeks.
 * @param {number} recency.d An amount of time to look back in days.
 * @param {number} recency.h An amount of time to look back in hours.
 * @param {number} recency.m An amount of time to look back in minues.
 * @param {number} recency.s An amount of time to look back in seconds.
 * @param {number} recency.ms An amount of time to look back in milliseconds.
*/
function findRecentSecondings(seconderId, recency = { d: 2 }) {
	return db.models.Seconding.findAll({ where: { seconderId, createdAt: { [Op.gt]: dateInPast(recency) } } });
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
 * @param {string} senderId
 * @param {Set<string>} toasteeIds
 * @param {Record<string, Hunter>} hunterMap
 * @param {string} seasonId
 * @param {string} toastText
 * @param {string | null} imageURL
 */
async function raiseToast(guild, company, senderId, toasteeIds, hunterMap, seasonId, toastText, imageURL) {
	// Make database entities
	const recentToasts = await db.models.Toast.findAll({ where: { companyId: guild.id, senderId, createdAt: { [Op.gt]: dateInPast({ d: 2 }) } }, include: db.models.Toast.Recipients });
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
			idSet.add(reciept.recipientId);
		})
		return idSet;
	}, new Set());

	const staleToastees = await findStaleToasteeIds(senderId, guild.id);

	const toast = await db.models.Toast.create({ companyId: guild.id, senderId, text: toastText, imageURL });
	const rawRecipients = [];
	const rewardedHunterIds = [];
	let critValue = 0;
	const startingSenderLevel = hunterMap[senderId].getLevel(company.xpCoefficient);
	const hunterResults = {
		[senderId]: { previousLevel: startingSenderLevel, droppedItem: null }
	};
	for (const id of toasteeIds.values()) {
		const rawToast = { toastId: toast.id, recipientId: id, isRewarded: !hunterIdsToastedInLastDay.has(id) && rewardsAvailable > 0, wasCrit: false };
		if (rawToast.isRewarded) {
			rewardedHunterIds.push(id);
			const hunter = hunterMap[id];
			hunterResults[id] = { previousLevel: hunter.getLevel(company.xpCoefficient), droppedItem: null };
			const xpAwarded = Math.floor(company.festivalMultiplier);
			await hunter.increment({ toastsReceived: 1, xp: xpAwarded });
			const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: guild.id, userId: id, seasonId }, defaults: { xp: xpAwarded } });
			if (!participationCreated) {
				participation.increment({ xp: xpAwarded });
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
	const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: guild.id, userId: senderId, seasonId }, defaults: { xp: critValue, toastsRaised: 1 } });
	if (critValue > 0) {
		await hunterMap[senderId].increment({ toastsRaised: 1, xp: critValue });
		if (!participationCreated) {
			participation.increment({ xp: critValue, toastsRaised: 1 });
		}
	} else {
		hunterMap[senderId].increment("toastsRaised");
		participation.increment("toastsRaised");
	}

	return { toastId: toast.id, rewardedHunterIds, hunterResults, critValue };
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
