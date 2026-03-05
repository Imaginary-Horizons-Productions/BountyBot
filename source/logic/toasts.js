const { Guild, userMention } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { dateInPast } = require("../shared");
const { Company, Hunter, Toast, Recipient } = require("../database/models");

/** @type {Sequelize} */
let db;

function setDB(database) {
	db = database;
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
 * @returns {Promise<Toast & {Recipients: Recipient[]} | null>}
 */
function findToastByPK(toastId) {
	return db.models.Toast.findByPk(toastId, { include: db.models.Toast.Recipients });
}

/** *Reaction Toasts: finds a toast by the reacted message's id*
 * @param {import("discord.js").Snowflake} messageId
 */
function findToastByMessageId(messageId) {
	if (messageId === null) {
		return null;
	}
	return db.models.Toast.findOne({ where: { hostMessageId: messageId } });
}

/** *Get the Mentions of Bounty Hunters that have seconded a given Toast*
 * @param {string} toastId
 */
async function findSecondingMentions(toastId) {
	return (await db.models.Seconding.findAll({ where: { toastId } })).map(seconding => userMention(seconding.seconderId));
}

/**
 *	f(x) > 150/(x+2)^(1/3)
 *	where:
 *	- f(x) = critRoll
 *	- x + 2 = effectiveToastLevel
 *	- 150^3 = 3375000
 *
 * notes:
 * - cubing both sides of the equation avoids the third root operation and prebakes the constant exponentiation
 * - constants set arbitrarily by user experience design
 * @param {number} critRoll
 * @param {number} effectiveToastLevel
 */
function isToastCrit(critRoll, effectiveToastLevel) {
	return critRoll * critRoll * critRoll > 3375000 / effectiveToastLevel
}

/**
 * @param {Guild} guild
 * @param {Company} company
 * @param {string} senderId
 * @param {Set<string>} toasteeIds
 * @param {Map<string, Hunter>} hunterMap
 * @param {string} seasonId
 * @param {string} toastText
 * @param {string | null} imageURL
 * @param {string | null} hostMessageId
 */
async function raiseToast(guild, company, senderId, toasteeIds, hunterMap, seasonId, toastText, imageURL = null, hostMessageId = null) {
	const hunterReceipts = new Map();
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

	const toast = await db.models.Toast.create({ companyId: guild.id, senderId, text: toastText, imageURL, hostMessageId });
	const rawRecipients = [];
	let critValue = 0;
	const startingSenderLevel = hunterMap.get(senderId).getLevel(company.xpCoefficient);
	const xpMultiplierString = company.festivalMultiplierString("xp");
	for (const id of toasteeIds.values()) {
		const rawToast = { toastId: toast.id, recipientId: id, isRewarded: !hunterIdsToastedInLastDay.has(id) && rewardsAvailable > 0, wasCrit: false };
		if (rawToast.isRewarded) {
			const hunterReceipt = {};
			hunterReceipt.xp = 1;
			hunterReceipt.xpMultiplier = xpMultiplierString;

			let hunter = hunterMap.get(id);
			const previousLevel = hunter.getLevel(company.xpCoefficient);
			const xpAwarded = Math.floor(company.xpFestivalMultiplier);
			hunter = await hunter.increment({ toastsReceived: 1, xp: xpAwarded });
			const currentLevel = hunter.getLevel(company.xpCoefficient);
			if (currentLevel > previousLevel) {
				hunterReceipt.levelUp = { achievedLevel: currentLevel, previousLevel };
			}
			hunterReceipts.set(id, hunterReceipt);

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

				if (isToastCrit(critRoll, effectiveToastLevel)) {
					rawToast.wasCrit = true;
					critValue += 1;
					critToastsAvailable--;
				}
			}

			rewardsAvailable--;
		}
		rawRecipients.push(rawToast);
	}
	await db.models.Recipient.bulkCreate(rawRecipients);

	// Update sender
	const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: guild.id, userId: senderId, seasonId }, defaults: { xp: critValue, toastsRaised: 1 } });
	if (critValue > 0) {
		const senderReceipt = { xp: critValue, xpMultiplier: xpMultiplierString, title: "Critical Toast!" };
		let sender = hunterMap.get(senderId);
		const previousSenderLevel = sender.getLevel(company.xpCoefficient);
		sender = await hunterMap.get(senderId).increment({ toastsRaised: 1, xp: critValue });
		const currentSenderLevel = sender.getLevel(company.xpCoefficient);
		if (currentSenderLevel > previousSenderLevel) {
			senderReceipt.levelUp = { achievedLevel: currentSenderLevel, previousLevel: previousSenderLevel };
		}
		hunterReceipts.set(senderId, senderReceipt);
		if (!participationCreated) {
			participation.increment({ xp: critValue, toastsRaised: 1 });
		}
	} else {
		hunterMap.get(senderId).increment("toastsRaised");
		participation.increment("toastsRaised");
	}

	return { toastId: toast.id, hunterReceipts };
}

/**
 * @param {Hunter} seconder
 * @param {Toast} toast
 * @param {Company} company
 * @param {string[]} recipientIds
 * @param {string} seasonId
 */
async function secondToast(seconder, toast, company, recipientIds, seasonId) {
	await seconder.increment("toastsSeconded");
	await toast.increment("secondings");

	const hunterReceipts = new Map();

	const xpMultiplierString = company.festivalMultiplierString();
	for (const userId of recipientIds) {
		const hunterReceipt = {};
		const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: company.id, userId, seasonId }, defaults: { xp: 1 } });
		if (!participationCreated) {
			participation.increment({ xp: 1 });
		}
		let hunter = await db.models.Hunter.findOne({ where: { userId, companyId: company.id } });
		if (hunter) {
			const previousLevel = hunter.getLevel(company.xpCoefficient);
			hunter = await hunter.increment({ toastsReceived: 1, xp: 1 }).then(hunter => hunter.reload());
			hunterReceipt.xp = 1;
			hunterReceipt.xpMultiplier = xpMultiplierString;
			const currentLevel = hunter.getLevel(company.xpCoefficient);
			if (currentLevel > previousLevel) {
				hunterReceipt.levelUp = { achievedLevel: currentLevel, previousLevel };
			}
			hunterReceipts.set(userId, hunterReceipt);
		}
	}

	const recentToasts = await db.models.Seconding.findAll({ where: { seconderId: seconder.userId, createdAt: { [Op.gt]: dateInPast({ d: 2 }) } } });
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
	if (critSecondsAvailable > 0) {
		const startingSeconderLevel = seconder.getLevel(company.xpCoefficient);
		const staleToastees = await findStaleToasteeIds(seconder.userId, company.id);
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

		if (isToastCrit(Math.random() * 100, lowestEffectiveToastLevel)) {
			critSeconds++;
			recipientIds.push(seconder.userId);
		}
	}

	await db.models.Seconding.create({ toastId: toast.id, seconderId: seconder.userId, wasCrit: critSeconds > 0 });
	if (critSeconds > 0) {
		const hunterReceipt = { title: "Critical Toast!", xp: critSeconds };
		const previousSenderLevel = seconder.getLevel(company.xpCoefficient);
		await seconder.increment({ xp: critSeconds }).then(seconder => seconder.reload());
		const currentSenderLevel = seconder.getLevel(company.xpCoefficient);
		if (currentSenderLevel > previousSenderLevel) {
			hunterReceipt.levelUp = { achievedLevel: currentSenderLevel, previousLevel: previousSenderLevel };
		}
		hunterReceipts.set(seconder.userId, hunterReceipt);
		const [participation, participationCreated] = await db.models.Participation.findOrCreate({ where: { companyId: company.id, userId: seconder.userId, seasonId }, defaults: { xp: critSeconds } });
		if (!participationCreated) {
			participation.increment({ xp: critSeconds });
		}
	}
	return hunterReceipts;
}

/**
 * @param {string} toastId
 * @param {string} messageId
 */
function setToastMessageId(toastId, messageId) {
	return db.models.Toast.update({ toastMessageId: messageId }, { where: { id: toastId } });
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

/**
 * @param {string} userId
 * @param {string} companyId
 */
async function deleteHunterToasts(userId, companyId) {
	for (const toast of await db.models.Toast.findAll({ where: { senderId: userId, companyId } })) {
		await db.models.Recipient.destroy({ where: { toastId: toast.id } });
		await db.models.Seconding.destroy({ where: { toastId: toast.id } });
		await toast.destroy();
	}
}

module.exports = {
	setDB,
	findToastByMessageId,
	findSecondingMentions,
	findMostSecondedToast,
	wasAlreadySeconded,
	findToastByPK,
	findSecondingMentions,
	raiseToast,
	secondToast,
	setToastMessageId,
	deleteCompanyToasts,
	deleteHunterToasts
}
