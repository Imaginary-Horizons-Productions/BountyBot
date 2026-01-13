const { EmbedBuilder, Colors, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle, heading, userMention, bold, italic, GuildMember, Role, Collection, GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType, unorderedList, TextInputBuilder, TextInputStyle, ModalBuilder, LabelBuilder } = require("discord.js");
const { MessageLimits, ModalLimits } = require("@sapphire/discord.js-utilities");
const { SAFE_DELIMITER, COMPANY_XP_COEFFICIENT, YEAR_IN_MS, SKIP_INTERACTION_HANDLING } = require("../../constants");
const { Bounty, Completion, Company, Season, Rank, Hunter } = require("../../database/models");
const { discordTimestamp, timeConversion } = require("../../shared");

/**
 * @param {Guild} guild
 * @param {number} companyXP
 * @param {number} participantCount
 * @param {Season} currentSeason
 * @param {Season} lastSeason
 */
async function companyStatsEmbed(guild, companyXP, participantCount, currentSeason, lastSeason) {
	const currentCompanyLevel = Company.getLevel(companyXP);
	const currentLevelThreshold = Hunter.xpThreshold(currentCompanyLevel, COMPANY_XP_COEFFICIENT);
	const nextLevelThreshold = Hunter.xpThreshold(currentCompanyLevel + 1, COMPANY_XP_COEFFICIENT);
	const currentSeasonXP = await currentSeason.totalXP;
	const lastSeasonXP = await lastSeason?.totalXP ?? 0;

	const particpantPercentage = participantCount / guild.memberCount * 100;
	const seasonXPDifference = currentSeasonXP - lastSeasonXP;
	const seasonBountyDifference = currentSeason.bountiesCompleted - (lastSeason?.bountiesCompleted ?? 0);
	const seasonToastDifference = currentSeason.toastsRaised - (lastSeason?.toastsRaised ?? 0);
	return new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setTitle(`${guild.name} is __Level ${currentCompanyLevel}__`)
		.setThumbnail(guild.iconURL())
		.setDescription(`${fillableTextBar(companyXP - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}*Next Level:* ${nextLevelThreshold - companyXP} Bounty Hunter Levels`)
		.addFields(
			{ name: "Total Bounty Hunter Level", value: `${companyXP} level${companyXP == 1 ? "" : "s"}`, inline: true },
			{ name: "Participation", value: `${participantCount} server members have interacted with BountyBot this season (${particpantPercentage.toPrecision(3)}% of server members)` },
			{ name: `${currentSeasonXP} XP Earned Total (${seasonXPDifference === 0 ? "same as last season" : `${seasonXPDifference > 0 ? `+${seasonXPDifference} more XP` : `${seasonXPDifference * -1} fewer XP`} than last season`})`, value: `${currentSeason.bountiesCompleted} bounties (${seasonBountyDifference === 0 ? "same as last season" : `${seasonBountyDifference > 0 ? `**+${seasonBountyDifference} more bounties**` : `**${seasonBountyDifference * -1} fewer bounties**`} than last season`})\n${currentSeason.toastsRaised} toasts (${seasonToastDifference === 0 ? "same as last season" : `${seasonToastDifference > 0 ? `**+${seasonToastDifference} more toasts**` : `**${seasonToastDifference * -1} fewer toasts**`} than last season`})` }
		)
		.setFooter(randomFooterTip())
		.setTimestamp()
}

/**
 * @param {keyof Colors} profileColor
 * @param {Guild} guild
 * @param {string} thumbnailURL
 * @param {GuildMember} winner
 * @param {string} qualificationText
 */
function raffleResultEmbed(profileColor, guild, thumbnailURL, winner, qualificationText) {
	const embed = new EmbedBuilder().setColor(Colors[profileColor])
		.setAuthor({ name: guild.name, iconURL: guild.iconURL() })
		.setTitle("Raffle Results")
		.setThumbnail(thumbnailURL)
		.setDescription(`The winner of this raffle is: ${winner}`)
		.addFields({ name: "Qualifications", value: qualificationText })
		.setTimestamp();

	if (guild.bannerURL()) {
		embed.setImage(guild.bannerURL());
	}
	return embed;
}

/**
 * @param {number} level
 * @param {number} maxSlots
 * @param {boolean} futureReward
 */
function getHunterLevelUpRewards(level, maxSlots, futureReward = true) {
	const texts = [];
	if (level % 2) {
		texts.push(`Your bounties in odd-numbered slots ${futureReward ? "will increase" : "have increased"} in value.`);
	} else {
		texts.push(`Your bounties in even-numbered slots ${futureReward ? "will increase" : "have increased"} in value.`);
	}
	const currentSlots = Hunter.getBountySlotCount(level, maxSlots);
	if (currentSlots < maxSlots) {
		if (level == 3 + 12 * Math.floor((currentSlots - 2) / 2) + 7 * ((currentSlots - 2) % 2)) {
			texts.push(` You ${futureReward ? "will unlock" : "have unlocked"} bounty slot #${currentSlots}.`);
		};
	}
	return texts;
}

/**
 * @param {Hunter} hunter
 * @param {number} previousLevel
 * @param {number} xpCoefficient
 * @param {number} maxSimBounties
 */
function buildHunterLevelUpLine(hunter, previousLevel, xpCoefficient, maxSimBounties) {
	const currentLevel = hunter.getLevel(xpCoefficient);
	if (currentLevel > previousLevel) {
		const rewards = [];
		for (let level = previousLevel + 1; level <= currentLevel; level++) {
			rewards.push(...getHunterLevelUpRewards(level, maxSimBounties, false));
		}
		return `${randomCongratulatoryPhrase()}, ${userMention(hunter.userId)}! You have leveled up to level ${bold(currentLevel)}!\n\t- ${rewards.join('\n\t- ')}`;
	}
	return null;
}

/**
 * @param {Hunter} hunter
 * @param {Guild} guild
 * @param {GuildMember} member
 * @param {number} dqCount
 * @param {(Bounty & {Completions: Completion[]})[]} lastFiveBounties
 */
function modStatsEmbed(hunter, guild, member, dqCount, lastFiveBounties) {
	const embed = new EmbedBuilder().setColor(member.displayColor)
		.setAuthor({ name: guild.name, iconURL: guild.iconURL() })
		.setTitle(`Moderation Stats: ${member.user.tag}`)
		.setThumbnail(member.user.avatarURL())
		.setDescription(`Display Name: **${member.displayName}** (id: *${member.id}*)\nAccount created on: ${member.user.createdAt.toDateString()}\nJoined server on: ${member.joinedAt.toDateString()}`)
		.addFields(
			{ name: "Bans", value: `Currently Banned: ${hunter.isBanned ? "Yes" : "No"}\nHas Been Banned: ${hunter.hasBeenBanned ? "Yes" : "No"}`, inline: true },
			{ name: "Disqualifications", value: `${dqCount} season DQs`, inline: true },
			{ name: "Penalties", value: `${hunter.penaltyCount} penalties (${hunter.penaltyPointTotal} points total)`, inline: true }
		)
		.setFooter(randomFooterTip())
		.setTimestamp();

	let bountyHistory = "";
	for (let i = 0; i < lastFiveBounties.length; i++) {
		const bounty = lastFiveBounties[i];
		bountyHistory += `__${bounty.title}__${bounty.description !== null ? ` ${bounty.description}` : ""}${sentenceListEN(bounty.Completions.map(completion => `\n${userMention(completion.userId)} +${completion.xpAwarded} XP`))}\n\n`;
	}

	if (bountyHistory === "") {
		bountyHistory = "No recent bounties";
	}
	return embed.addFields({ name: "Last 5 Completed Bounties Created by this User", value: bountyHistory });
}

/**
 * @param {string} thumbnailURL
 * @param {string} toastText
 * @param {Set<string>} recipientIdSet
 * @param {GuildMember} senderMember
 */
function generateToastEmbed(thumbnailURL, toastText, recipientIdSet, senderMember) {
	return new EmbedBuilder().setColor("e5b271")
		.setThumbnail(thumbnailURL)
		.setTitle(toastText)
		.setDescription(`A toast to ${sentenceListEN(Array.from(recipientIdSet).map(id => userMention(id)))}!`)
		.setFooter({ text: senderMember.displayName, iconURL: senderMember.user.avatarURL() });
}

/** @param {string} toastId */
function generateSecondingActionRow(toastId) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`secondtoast${SAFE_DELIMITER}${toastId}`)
			.setLabel("Hear, hear!")
			.setEmoji("🥂")
			.setStyle(ButtonStyle.Primary)
	)
}

/**
 * @param {string[]} rewardedHunterIds
 * @param {string[]} rankUpdates
 * @param {string[]} rewardTexts
 * @param {string} senderMention
 * @param {string} multiplierString
 * @param {number} critValue
 */
function generateToastRewardString(rewardedHunterIds, rankUpdates, rewardTexts, senderMention, multiplierString, critValue) {
	let rewardString = `${heading("XP Gained", 2)}\n${rewardedHunterIds.map(id => `${userMention(id)} +1 XP${multiplierString}`).join("\n")}`;
	if (critValue > 0) {
		rewardString += `\n${senderMention} + ${critValue} XP${multiplierString} ${italic("Critical Toast!")}`;
	}
	if (rankUpdates.length > 0) {
		rewardString += `\n${heading("Rank Ups", 2)}\n${unorderedList(rankUpdates)}`;
	}
	if (rewardTexts.length > 0) {
		rewardString += `\n${heading("Rewards", 2)}\n${unorderedList(rewardTexts)}`;
	}
	if (rewardString.length > MessageLimits.MaximumLength) {
		return `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
	}
	return rewardString;
}

/** @param {string[]} contributorIds */
function generateCompletionEmbed(contributorIds) {
	return new EmbedBuilder().setColor("e5b271")
		.setTitle("Server Goal Completed")
		.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
		.setDescription(`${randomCongratulatoryPhrase()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
		.addFields({ name: "Contributors", value: sentenceListEN(contributorIds.map(id => userMention(id))) })
}

/**
 * @param {string} seconderDisplayName
 * @param {string[]} recipientIds
 * @param {string[]} rankUpdates
 * @param {string[]} rewardTexts
 */
function generateSecondingRewardString(seconderDisplayName, recipientIds, rankUpdates, rewardTexts) {
	let text = `${seconderDisplayName} seconded this toast!`;
	if (recipientIds.length > 0) {
		text += `\n${heading("XP Gained", 2)}`;
	}
	for (const id of recipientIds) {
		text += `\n${userMention(id)} +1 XP`;
		if (id === seconderDisplayName) {
			text += ` ${italic("Critical Toast!")}`;
		}
	}
	if (rankUpdates.length > 0) {
		text += `\n${heading("Rank Ups", 2)}\n${unorderedList(rankUpdates)}`;
	}
	if (rewardTexts.length > 0) {
		text += `\n${heading("Rewards", 2)}\n${unorderedList(rewardTexts)}`;
	}
	if (text.length > MessageLimits.MaximumLength) {
		return `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
	}
	return text;
}

/**
 * @param {Record<string, { previousLevel: number, droppedItem: string | null }>} hunterResults
 * @param {Map<string, Hunter>} hunterMap
 * @param {Company} company
 */
function formatHunterResultsToRewardTexts(hunterResults, hunterMap, company) {
	/** @type {string[]} */
	const rewardTexts = [];
	for (const id in hunterResults) {
		const { previousLevel, droppedItem } = hunterResults[id];
		const hunterLevelLine = buildHunterLevelUpLine(hunterMap.get(id), previousLevel, company.xpCoefficient, company.maxSimBounties);
		if (hunterLevelLine) {
			rewardTexts.push(hunterLevelLine);
		}
		if (droppedItem) {
			rewardTexts.push(`${userMention(id)} has found a ${bold(droppedItem)}!`);
		}
	}
	return rewardTexts;
}

/**
 * @param {Record<string, { newPlacement: number } | { newRankIndex: number | null, rankIncreased: boolean }>} seasonResults
 * @param {Rank[]} descendingRanks
 * @param {Collection<string, Role>} allGuildRoles
 */
function formatSeasonResultsToRewardTexts(seasonResults, descendingRanks, allGuildRoles) {
	/** @type {string[]} */
	const rewardTexts = [];
	for (const id in seasonResults) {
		const result = seasonResults[id];
		if (result.newPlacement === 1) {
			rewardTexts.push(italic(`${userMention(id)} has reached the #1 spot for this season!`));
		}
		if (result.rankIncreased) {
			const rank = descendingRanks[result.newRankIndex];
			const rankName = rank.roleId ? allGuildRoles.get(rank.roleId).name : `Rank ${result.newRankIndex + 1}`;
			rewardTexts.push(`${randomCongratulatoryPhrase()}, ${userMention(id)}! You've risen to ${bold(rankName)}!`);
		}
	}
	return rewardTexts;
}

/**
 * @param {number?} startTimestamp Unix timestamp (seconds since Jan 1 1970)
 * @param {number?} endTimestamp Unix timestamp (seconds since Jan 1 1970)
 */
function validateScheduledEventTimestamps(startTimestamp, endTimestamp) {
	const errors = [];
	const nowTimestamp = Date.now() / 1000;

	if (!startTimestamp) {
		errors.push(`Start Timestamp must be an integer. Received: ${startTimestamp}`);
	}

	if (nowTimestamp >= startTimestamp || startTimestamp >= nowTimestamp + (5 * YEAR_IN_MS)) {
		errors.push(`Start Timestamp must be between now and 5 years in the future. Received: ${startTimestamp}, which computes to ${discordTimestamp(startTimestamp)}`);
	}

	if (!endTimestamp) {
		errors.push(`End Timestamp must be an integer. Received: ${endTimestamp}`);
	}

	if (nowTimestamp >= endTimestamp || endTimestamp >= nowTimestamp + (5 * YEAR_IN_MS)) {
		errors.push(`End Timestamp must be between now and 5 years in the future. Received: ${endTimestamp}, which computes to ${discordTimestamp(endTimestamp)}`);
	}

	if (startTimestamp > endTimestamp) {
		errors.push(`End Timestamp (${discordTimestamp(endTimestamp)}) was before Start Timestamp (${discordTimestamp(startTimestamp)}).`);
	}
	return errors;
}

/**
 * @param {string} title
 * @param {string} posterName
 * @param {number} slotNumber
 * @param {string?} description
 * @param {string?} imageURL
 * @param {number?} startTimestamp Unix timestamp (seconds since Jan 1 1970)
 * @param {number?} endTimestamp Unix timestamp (seconds since Jan 1 1970)
 */
function createBountyEventPayload(title, posterName, slotNumber, description, imageURL, startTimestamp, endTimestamp) {
	const payload = {
		name: `Bounty: ${title}`,
		scheduledStartTime: startTimestamp * 1000,
		scheduledEndTime: endTimestamp * 1000,
		privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
		entityType: GuildScheduledEventEntityType.External,
		entityMetadata: { location: `${posterName}'s #${slotNumber} Bounty` }
	};
	if (description) {
		payload.description = description;
	}
	if (imageURL) {
		payload.image = imageURL;
	}
	return payload;
}

/**
 * @param {Bounty} bounty
 * @param {boolean} isEvergreen
 * @param {string} key for constructing the ModalBuilder's customId uniquely
 * @param {Guild} guild
 */
async function constructEditBountyModalAndOptions(bounty, isEvergreen, key, guild) {
	const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${SAFE_DELIMITER}${key}`)
		.setTitle(truncateTextToLength(`Edit Bounty: ${bounty.title}`, ModalLimits.MaximumTitleCharacters))
		.addLabelComponents(
			new LabelBuilder().setLabel("Title")
				.setTextInputComponent(
					new TextInputBuilder().setCustomId("title")
						.setRequired(false)
						.setStyle(TextInputStyle.Short)
						.setPlaceholder("Discord markdown allowed...")
						.setValue(bounty.title)
				),
			new LabelBuilder().setLabel("Description")
				.setTextInputComponent(
					new TextInputBuilder().setCustomId("description")
						.setRequired(false)
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder(isEvergreen ? "Bounties with clear instructions are easier to complete..." : "Get a 1 XP bonus on completion for the following: description, image URL, timestamps")
						.setValue(bounty.description ?? "")
				),
			new LabelBuilder().setLabel("Image URL")
				.setTextInputComponent(
					new TextInputBuilder().setCustomId("imageURL")
						.setRequired(false)
						.setStyle(TextInputStyle.Short)
						.setValue(bounty.attachmentURL ?? "")
				)
		);
	if (!isEvergreen) {
		const eventStartComponent = new TextInputBuilder().setCustomId("startTimestamp")
			.setRequired(false)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder("Required if making an event with the bounty");
		const eventEndComponent = new TextInputBuilder().setCustomId("endTimestamp")
			.setRequired(false)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder("Required if making an event with the bounty");

		if (bounty.scheduledEventId) {
			const scheduledEvent = await guild.scheduledEvents.fetch(bounty.scheduledEventId);
			eventStartComponent.setValue((scheduledEvent.scheduledStartTimestamp / 1000).toString());
			eventEndComponent.setValue((scheduledEvent.scheduledEndTimestamp / 1000).toString());
		}
		modal.addLabelComponents(
			new LabelBuilder().setLabel("Event Start (Unix Timestamp)")
				.setTextInputComponent(eventStartComponent),
			new LabelBuilder().setLabel("Event End (Unix Timestamp)")
				.setTextInputComponent(eventEndComponent)
		)
	}
	return { modal, submissionOptions: { filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") } };
}

module.exports = {
	companyStatsEmbed,
	raffleResultEmbed,
	getHunterLevelUpRewards,
	buildHunterLevelUpLine,
	modStatsEmbed,
	generateToastEmbed,
	generateSecondingActionRow,
	generateToastRewardString,
	generateCompletionEmbed,
	generateSecondingRewardString,
	formatHunterResultsToRewardTexts,
	formatSeasonResultsToRewardTexts,
	validateScheduledEventTimestamps,
	createBountyEventPayload,
	constructEditBountyModalAndOptions
};
