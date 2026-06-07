import { Guild, Snowflake, userMention } from "discord.js";
import { Op } from "sequelize";
import type { Database, DatabaseTypes } from "../database";
import { dateInPast } from "../shared";

let db: Database;

export function setDB(database: Database) {
	db = database;
}

/** *Get the ids of the rewarded Recipients on the sender's last 5 Toasts*
 *
 * Duplicated stale toastee ids are intended as a way of recording accumulating staleness
 */
async function findStaleToasteeIds(senderId: Snowflake, companyId: Snowflake) {
	const lastFiveToasts = await db.Toasts.findAll({ where: { senderId, companyId }, include: db.Toasts.Recipients, order: [["createdAt", "DESC"]], limit: 5 });
	return lastFiveToasts.reduce((list, toast) => {
		return list.concat(toast.Recipients.filter(reciept => reciept.isRewarded).map(reciept => reciept.recipientId));
	}, []);
}

/** *Find a specified Hunter's most seconded Toast* */
export function findMostSecondedToast(senderId: Snowflake, companyId: Snowflake) {
	return db.Toasts.findOne({ where: { senderId, companyId, secondings: { [Op.gt]: 0 } }, order: [["secondings", "DESC"]] });
}

/** *Checks if the specified seconder has already seconded the specified Toast* */
export async function wasAlreadySeconded(toastId: Snowflake, seconderId: Snowflake) {
	return Boolean(await db.Secondings.findOne({ where: { toastId, seconderId } }));
}

/** *Find the specified Toast* */
export function findToastByPK(toastId: Snowflake) {
	return db.Toasts.findByPk(toastId, { include: db.Toasts.Recipients });
}

/** *Reaction Toasts: finds a toast by the reacted message's id* */
export function findToastByMessageId(messageId: Snowflake) {
	if (messageId === null) {
		return null;
	}
	return db.Toasts.findOne({ where: { hostMessageId: messageId } });
}

/** *Get the Mentions of Bounty Hunters that have seconded a given Toast* */
export async function findSecondingMentions(toastId: Snowflake) {
	return (await db.Secondings.findAll({ where: { toastId } })).map(seconding => userMention(seconding.seconderId));
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
 */
function isToastCrit(critRoll: number, effectiveToastLevel: number) {
	return critRoll * critRoll * critRoll > 3375000 / effectiveToastLevel
}

export async function raiseToast(guild: Guild, company: DatabaseTypes.Company, senderId: Snowflake, toasteeIds: Snowflake[], hunterMap: Map<Snowflake, DatabaseTypes.Hunter>, seasonId: string, toastText: string, imageURL: string | null = null, hostMessageId: Snowflake | null = null) {
	const hunterReceipts = new Map();
	// Make database entities
	const recentToasts = await db.Toasts.findAll({ where: { companyId: guild.id, senderId, createdAt: { [Op.gt]: dateInPast({ d: 2 }) } }, include: db.Toasts.Recipients });
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

	const toast = await db.Toasts.create({ companyId: guild.id, senderId, text: toastText, imageURL, hostMessageId });
	const rawRecipients = [];
	let critValue = 0;
	const startingSenderLevel = hunterMap.get(senderId).getLevel(company.xpCoefficient);
	const xpMultiplierString = company.festivalMultiplierString("xp");
	for (const id of toasteeIds) {
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

			const [participation, participationCreated] = await db.Participations.findOrCreate({ where: { companyId: guild.id, userId: id, seasonId }, defaults: { xp: xpAwarded } });
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
	await db.Recipients.bulkCreate(rawRecipients);

	// Update sender
	const [participation, participationCreated] = await db.Participations.findOrCreate({ where: { companyId: guild.id, userId: senderId, seasonId }, defaults: { xp: critValue, toastsRaised: 1 } });
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

export async function secondToast(seconder: DatabaseTypes.Hunter, toast: DatabaseTypes.Toast, company: DatabaseTypes.Company, recipientIds: Snowflake[], seasonId: string) {
	await seconder.increment("toastsSeconded");
	await toast.increment("secondings");

	const hunterReceipts = new Map();

	const xpMultiplierString = company.festivalMultiplierString("xp");
	for (const userId of recipientIds) {
		if (userId === seconder.userId) {
			continue;
		}
		const hunterReceipt = {};
		const [participation, participationCreated] = await db.Participations.findOrCreate({ where: { companyId: company.id, userId, seasonId }, defaults: { xp: 1 } });
		if (!participationCreated) {
			participation.increment({ xp: 1 });
		}
		let hunter = await db.Hunters.findOne({ where: { userId, companyId: company.id } });
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

	const recentToasts = await db.Secondings.findAll({ where: { seconderId: seconder.userId, createdAt: { [Op.gt]: dateInPast({ d: 2 }) } } });
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
		}
	}

	await db.Secondings.create({ toastId: toast.id, seconderId: seconder.userId, wasCrit: critSeconds > 0 });
	if (critSeconds > 0) {
		const hunterReceipt = { title: "Critical Toast!", xp: critSeconds };
		const previousSenderLevel = seconder.getLevel(company.xpCoefficient);
		await seconder.increment({ xp: critSeconds }).then(seconder => seconder.reload());
		const currentSenderLevel = seconder.getLevel(company.xpCoefficient);
		if (currentSenderLevel > previousSenderLevel) {
			hunterReceipt.levelUp = { achievedLevel: currentSenderLevel, previousLevel: previousSenderLevel };
		}
		hunterReceipts.set(seconder.userId, hunterReceipt);
		const [participation, participationCreated] = await db.Participations.findOrCreate({ where: { companyId: company.id, userId: seconder.userId, seasonId }, defaults: { xp: critSeconds } });
		if (!participationCreated) {
			participation.increment({ xp: critSeconds });
		}
	}
	return hunterReceipts;
}

export function setToastMessageId(toastId: string, messageId: Snowflake) {
	return db.Toasts.update({ toastMessageId: messageId }, { where: { id: toastId } });
}

/** *Deletes all Toasts, Recipients, and Secondings for a specified Company* */
export async function deleteCompanyToasts(companyId: Snowflake) {
	const toasts = await db.Toasts.findAll({ where: { companyId } });
	for (const toast of toasts) {
		await db.Recipients.destroy({ where: { toastId: toast.id } });
		await db.Secondings.destroy({ where: { toastId: toast.id } });
		await toast.destroy();
	}
}

export async function deleteHunterToasts(userId: Snowflake, companyId: Snowflake) {
	for (const toast of await db.Toasts.findAll({ where: { senderId: userId, companyId } })) {
		await db.Recipients.destroy({ where: { toastId: toast.id } });
		await db.Secondings.destroy({ where: { toastId: toast.id } });
		await toast.destroy();
	}
}
