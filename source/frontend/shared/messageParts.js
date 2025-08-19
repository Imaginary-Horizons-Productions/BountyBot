const fs = require("fs");
const { EmbedBuilder, Colors, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle, heading, userMention, MessageFlags, bold, italic, GuildMember, Role, Collection } = require("discord.js");
const { MessageLimits, EmbedLimits } = require("@sapphire/discord.js-utilities");
const { SAFE_DELIMITER, COMPANY_XP_COEFFICIENT, commandIds } = require("../../constants");
const { Bounty, Completion, Company, Season, Rank, Participation, Hunter } = require("../../database/models");
const { timeConversion, descendingByProperty } = require("../../shared");

/** generates a command mention, which users can click to shortcut them to using the command
 * @param {string} fullCommand for subcommands append a whitespace and the subcommandName
 */
function commandMention(fullCommand) {
	const [mainCommand] = fullCommand.split(" ");
	if (!(mainCommand in commandIds)) {
		return `\`/${fullCommand}\``;
	}

	return `</${fullCommand}:${commandIds[mainCommand]}>`;
}

const CONGRATULATORY_PHRASES = [
	"Congratulations",
	"Well done",
	"You've done it",
	"Nice",
	"Awesome"
];

/** Return a random congragulatory phrase
 * @returns {string}
 */
function congratulationBuilder() {
	return CONGRATULATORY_PHRASES[Math.floor(CONGRATULATORY_PHRASES.length * Math.random())];
}

/** Create a text-only ratio bar that fills left to right
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} barLength
 */
function generateTextBar(numerator, denominator, barLength) {
	const filledBlocks = Math.floor(barLength * numerator / denominator);
	let bar = "";
	for (let i = 0; i < barLength; i++) {
		if (filledBlocks > i) {
			bar += "▰";
		} else {
			bar += "▱";
		}
	}
	return bar;
}

const NUMBER_EMOJI = {
	0: '0️⃣',
	1: '1️⃣',
	2: '2️⃣',
	3: '3️⃣',
	4: '4️⃣',
	5: '5️⃣',
	6: '6️⃣',
	7: '7️⃣',
	8: '8️⃣',
	9: '9️⃣',
	10: '🔟'
};
/**
 * @param {number} number
 * @returns {string}
 */
function getNumberEmoji(number) {
	if (number in NUMBER_EMOJI) {
		return NUMBER_EMOJI[number];
	} else {
		return '#️⃣';
	}
}

/** Formats string array into Oxford English list syntax
 *  @param {string[]} texts
 *  @param {boolean} isMutuallyExclusive
 */
function listifyEN(texts, isMutuallyExclusive) {
	if (texts.length > 2) {
		const textsSansLast = texts.slice(0, texts.length - 1);
		if (isMutuallyExclusive) {
			return `${textsSansLast.join(", ")}, or ${texts[texts.length - 1]}`;
		} else {
			return `${textsSansLast.join(", ")}, and ${texts[texts.length - 1]}`;
		}
	} else if (texts.length === 2) {
		if (isMutuallyExclusive) {
			return texts.join(" or ");
		} else {
			return texts.join(" and ");
		}
	} else if (texts.length === 1) {
		return texts[0];
	} else {
		return "";
	}
}

const discordIconURL = "https://cdn.discordapp.com/attachments/618523876187570187/1110265047516721333/discord-mark-blue.png";
const bountyBotIcon = "https://cdn.discordapp.com/attachments/618523876187570187/1138968614364528791/BountyBotIcon.jpg";
/** @type {import("discord.js").EmbedFooterData[]} */
const discordTips = [
	"Message starting with @silent don't send notifications; good for when everyone's asleep.",
	"Surround your message with || to mark it a spoiler (not shown until reader clicks on it).",
	"Surround a part of your messag with ~~ to add strikethrough styling.",
	"Don't forget to check slash commands for optional arguments.",
	"Some slash commands can be used in DMs, others can't.",
	"Server subscriptions cost more on mobile because the mobile app stores take a cut."
].map(text => ({ text, iconURL: discordIconURL }));
/** @type {import("discord.js").EmbedFooterData[]} */
const bountyBotTips = [
	"You can showcase one of your bounties once a week to increase its rewards.",
	"Send bug reports or feature requests with the \"/feedback\".",
	"Bounties can't be completed until 5 minutes after they've been posted. Don't make them too easy!",
	"You get XP for posting a bounty, but lose that XP if it's taken down before it's completed.",
	"You get XP when your bounties are completed. Thanks for posting!",
	"You get more XP when a bigger group completes your bounties. Thanks for organizing!",
	"Sometimes when you raise a toast to someone, it'll crit and grant you XP too!",
	"Your chance for Critical Toast is lower when repeatedly toasting the same bounty hunters. Spread the love!",
	"Users who can manage BountyBot aren't included in seasonal rewards to avoid conflicts of interest.",
	"Anyone can post a bounty, even you!",
	"Anyone can raise a toast, even you!",
	"The Overjustification Effect means a small reward can be less motivating than no reward.",
	"Manage bounties from within games with the Discord Overlay (default: Shift + Tab)!",
	"Server level is based on total bounty hunter level--higher server level means better evergreen bounty rewards.",
	"A bounty poster cannot complete their own bounty.",
	"Adding a description, image or time to a bounty all add 1 bonus XP for the poster.",
	"Bounty posters have double the chance to find items compared to completers."
].map(text => ({ text, iconURL: bountyBotIcon }));
const tipPool = bountyBotTips.concat(bountyBotTips, discordTips);

/** twice as likely to roll an application specific tip as a discord tip */
function randomFooterTip() {
	return tipPool[Math.floor(Math.random() * tipPool.length)];
}

/** Generate an embed for the given bounty
 * @param {Bounty} bounty
 * @param {Guild} guild
 * @param {number} posterLevel
 * @param {boolean} shouldOmitRewardsField
 * @param {Company} company
 * @param {Set<string>} hunterIdSet
 */
async function buildBountyEmbed(bounty, guild, posterLevel, shouldOmitRewardsField, company, hunterIdSet) {
	const author = await guild.members.fetch(bounty.userId);
	const fields = [];
	const embed = new EmbedBuilder().setColor(author.displayColor)
		.setThumbnail(bounty.thumbnailURL ?? company[`${bounty.state}BountyThumbnailURL`])
		.setTitle(bounty.state == "complete" ? `Bounty Complete! ${bounty.title}` : bounty.title)
		.setTimestamp();
	if (bounty.description) {
		embed.setDescription(bounty.description);
	}
	if (bounty.attachmentURL) {
		embed.setImage(bounty.attachmentURL);
	}
	if (bounty.scheduledEventId) {
		const event = await guild.scheduledEvents.fetch(bounty.scheduledEventId);
		fields.push({ name: "Time", value: `<t:${event.scheduledStartTimestamp / 1000}> - <t:${event.scheduledEndTimestamp / 1000}>` });
	}
	if (!shouldOmitRewardsField) {
		fields.push({ name: "Reward", value: `${Bounty.calculateCompleterReward(posterLevel, bounty.slotNumber, bounty.showcaseCount)} XP${company.festivalMultiplierString()}`, inline: true });
	}

	if (bounty.isEvergreen) {
		embed.setAuthor({ name: `Evergreen Bounty #${bounty.slotNumber}`, iconURL: author.user.displayAvatarURL() });
	} else {
		embed.setAuthor({ name: `${author.displayName}'s #${bounty.slotNumber} Bounty`, iconURL: author.user.displayAvatarURL() });
	}
	if (hunterIdSet.size > 0) {
		const completersFieldText = listifyEN(Array.from(hunterIdSet.values().map(id => userMention(id))));
		if (completersFieldText.length <= EmbedLimits.MaximumFieldValueLength) {
			fields.push({ name: "Turned in by:", value: completersFieldText });
		} else {
			fields.push({ name: "Turned in by:", value: "Too many to display!" });
		}
	}

	if (fields.length > 0) {
		embed.addFields(fields);
	}
	return embed;
}

/**
 * @param {MapIterator<string>} completerIds
 * @param {number} completerReward
 * @param {string?} posterId null for evergreen bounties
 * @param {number?} posterReward null for evergreen bounties
 * @param {string} multiplierString
 * @param {string[]} rankUpdates
 * @param {string[]} rewardTexts
 */
function generateBountyRewardString(completerIds, completerReward, posterId, posterReward, multiplierString, rankUpdates, rewardTexts) {
	let text = `${heading("XP Gained", 2)}\n${Array.from(completerIds.map(id => `${userMention(id)} +${completerReward} XP${multiplierString}`)).join("\n")}`;
	if (posterId && posterReward) {
		text += `\n${userMention(posterId)} +${posterReward} XP${multiplierString}`;
	}
	if (rankUpdates.length > 0) {
		text += `\n${heading("Rank Ups", 2)}\n- ${rankUpdates.join("\n- ")}`;
	}
	if (rewardTexts.length > 0) {
		text += `\n${heading("Rewards", 2)}\n- ${rewardTexts.join("\n- ")}`;
	}
	if (text.length > MessageLimits.MaximumLength) {
		return `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
	}
	return text;
}

/** @param {Bounty} bounty */
function generateBountyBoardButtons(bounty) {
	return [
		new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId(`bbcomplete${SAFE_DELIMITER}${bounty.id}`)
				.setStyle(ButtonStyle.Success)
				.setLabel("Complete")
				.setDisabled(new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))),
			new ButtonBuilder().setCustomId(`bbaddcompleters${SAFE_DELIMITER}${bounty.id}`)
				.setStyle(ButtonStyle.Primary)
				.setLabel("Record Turn-Ins"),
			new ButtonBuilder().setCustomId(`bbremovecompleters${SAFE_DELIMITER}${bounty.id}`)
				.setStyle(ButtonStyle.Secondary)
				.setLabel("Revoke Turn-Ins"),
			new ButtonBuilder().setCustomId(`bbshowcase${SAFE_DELIMITER}${bounty.id}`)
				.setStyle(ButtonStyle.Primary)
				.setLabel("Showcase"),
			new ButtonBuilder().setCustomId(`bbtakedown${SAFE_DELIMITER}${bounty.id}`)
				.setStyle(ButtonStyle.Danger)
				.setLabel("Take Down")
		)
	]
}

/** The version embed lists the following: changes in the most recent update, known issues in the most recent update, and links to support the project */
async function buildVersionEmbed() {
	const changelogPath = "./ChangeLog.md";
	const data = await fs.promises.readFile(changelogPath, { encoding: 'utf8' });
	const stats = await fs.promises.stat(changelogPath);
	const dividerRegEx = /## .+ Version/g;
	const changesStartRegEx = /\.\d+:/g;
	let titleStart = dividerRegEx.exec(data).index;
	changesStartRegEx.exec(data);
	let sectionEnd = dividerRegEx.exec(data).index;

	return new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setTitle(data.slice(titleStart + 3, changesStartRegEx.lastIndex))
		.setURL('https://discord.gg/JxqE9EpKt9')
		.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/734099622846398565/newspaper.png')
		.setDescription(data.slice(changesStartRegEx.lastIndex, sectionEnd).slice(0, EmbedLimits.MaximumDescriptionLength))
		.addFields({ name: "Become a Sponsor", value: "Chip in for server costs or get premium features by sponsoring [BountyBot on GitHub](https://github.com/Imaginary-Horizons-Productions/BountyBot)" })
		.setFooter(randomFooterTip())
		.setTimestamp(stats.mtime);
}

/**
 * @param {Company} company
 * @param {number} previousLevel
 * @param {Map<string, Hunter>} hunterMap
 * @param {string} guildName
 */
function buildCompanyLevelUpLine(company, previousLevel, hunterMap, guildName) {
	const currentLevel = Company.getLevel(company.getXP(hunterMap));
	if (currentLevel > previousLevel) {
		return `${guildName} is now level ${currentLevel}! Evergreen bounties now award more XP!`;
	}
	return null;
}

/** Apply the company's announcement prefix to the message (bots suppress notifications through flags instead of starting with "@silent")
 * @param {Company} company
 * @param {import('discord.js').MessageCreateOptions} messageOptions
 */
function sendAnnouncement(company, messageOptions) {
	if (company.announcementPrefix == "@silent") {
		if ("flags" in messageOptions) {
			messageOptions.flags |= MessageFlags.SuppressNotifications;
		} else {
			messageOptions.flags = MessageFlags.SuppressNotifications;
		}
	} else if (company.announcementPrefix != "") {
		messageOptions.content = `${company.announcementPrefix} ${messageOptions.content}`;
	}
	return messageOptions;
}

/** A seasonal scoreboard orders a company's hunters by their seasonal xp
 * @param {Company} company
 * @param {Guild} guild
 * @param {Map<string, Participation>} participationMap
 * @param {Rank[]} ranks
 * @param {{ goalId: string | null, requiredGP: number, currentGP: number }} goalProgress
 */
async function seasonalScoreboardEmbed(company, guild, participationMap, ranks, goalProgress) {
	const hunterMembers = await guild.members.fetch({ user: Array.from(participationMap.keys()) });
	const rankmojiArray = ranks.map(rank => rank.rankmoji);

	const scorelines = [];
	for (const [id, participation] of Array.from(participationMap.entries()).sort((a, b) => b[1].xp - a[1].xp)) {
		if (participation.xp > 0 && hunterMembers.has(id)) {
			scorelines.push(`${!(participation.rankIndex === null || participation.isRankDisqualified) ? `${rankmojiArray[participation.rankIndex]} ` : ""}#${participation.placement} **${hunterMembers.get(id).displayName}** ${participation.xp} season XP`);
		}
	}
	const embed = new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setThumbnail(company.scoreboardThumbnailURL)
		.setTitle("The Season Scoreboard")
		.setFooter(randomFooterTip())
		.setTimestamp();
	let description = "";
	const andMore = "…and more";
	const maxDescriptionLength = 2048 - andMore.length;
	for (const scoreline of scorelines) {
		if (description.length + scoreline.length <= maxDescriptionLength) {
			description += `${scoreline}\n`;
		} else {
			description += andMore;
			break;
		}
	}

	if (description) {
		embed.setDescription(description);
	} else {
		embed.setDescription("No Bounty Hunters yet…");
	}

	const fields = [];
	const { currentGP, requiredGP } = goalProgress;
	if (currentGP < requiredGP) {
		fields.push({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
	}
	if (company.festivalMultiplier !== 1) {
		fields.push({ name: "XP Festival", value: `An XP multiplier festival is currently active for ${company.festivalMultiplierString()}.` });
	}
	if (company.nextRaffleString) {
		fields.push({ name: "Next Raffle", value: `The next raffle will be on ${company.nextRaffleString}!` });
	}

	if (fields.length > 0) {
		embed.addFields(fields);
	}
	return embed;
}

/** An overall scoreboard orders a company's hunters by total xp
 * @param {Company} company
 * @param {Guild} guild
 * @param {Map<string, Hunter>} hunterMap
 * @param {Rank[]} ranks
 * @param {{ goalId: string | null, requiredGP: number, currentGP: number }} goalProgress
 */
async function overallScoreboardEmbed(company, guild, hunterMap, goalProgress) {
	const hunterMembers = await guild.members.fetch({ user: Array.from(hunterMap.keys()) });

	const scorelines = [];
	for (const hunter of Array.from(hunter.values()).sort(descendingByProperty("xp"))) {
		if (hunter.xp < 1) {
			break;
		}
		scorelines.push(`**${hunterMembers.get(hunter.userId).displayName}** __Level ${hunter.getLevel(company.xpCoefficient)}__ *${hunter.xp} XP*`);
	}
	const embed = new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setThumbnail(company.scoreboardThumbnailURL)
		.setTitle("The Scoreboard")
		.setFooter(randomFooterTip())
		.setTimestamp();
	let description = "";
	const andMore = "…and more";
	const maxDescriptionLength = 2048 - andMore.length;
	for (const scoreline of scorelines) {
		if (description.length + scoreline.length <= maxDescriptionLength) {
			description += `${scoreline}\n`;
		} else {
			description += andMore;
			break;
		}
	}

	if (description) {
		embed.setDescription(description);
	} else {
		embed.setDescription("No Bounty Hunters yet…");
	}

	const fields = [];
	const { currentGP, requiredGP } = goalProgress;
	if (currentGP < requiredGP) {
		fields.push({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
	}
	if (company.festivalMultiplier !== 1) {
		fields.push({ name: "XP Festival", value: `An XP multiplier festival is currently active for ${company.festivalMultiplierString()}.` });
	}
	if (company.nextRaffleString) {
		fields.push({ name: "Next Raffle", value: `The next raffle will be on ${company.nextRaffleString}!` });
	}

	if (fields.length > 0) {
		embed.addFields(fields);
	}

	return embed;
}

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
		.setDescription(`${generateTextBar(companyXP - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}*Next Level:* ${nextLevelThreshold - companyXP} Bounty Hunter Levels`)
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
		return `${congratulationBuilder()}, ${userMention(hunter.userId)}! You have leveled up to level ${bold(currentLevel)}!\n\t- ${rewards.join('\n\t- ')}`;
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
		bountyHistory += `__${bounty.title}__${bounty.description !== null ? ` ${bounty.description}` : ""}${listifyEN(bounty.Completions.map(completion => `\n${userMention(completion.userId)} +${completion.xpAwarded} XP`))}\n\n`;
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
		.setDescription(`A toast to ${listifyEN(Array.from(recipientIdSet).map(id => userMention(id)))}!`)
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
		rewardString += `\n${heading("Rank Ups", 2)}\n- ${rankUpdates.join("\n- ")}`;
	}
	if (rewardTexts.length > 0) {
		rewardString += `\n${heading("Rewards", 2)}\n- ${rewardTexts.join("\n- ")}`;
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
		.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
		.addFields({ name: "Contributors", value: listifyEN(contributorIds.map(id => userMention(id))) })
}

/**
 * @param {string} seconderDisplayName
 * @param {string[]} recipientIds
 * @param {string[]} rankUpdates
 * @param {string[]} rewardTexts
 */
function generateSecondingRewardString(seconderDisplayName, recipientIds, rankUpdates, rewardTexts) {
	let text = `${seconderDisplayName} seconded this toast!\n${heading("XP Gained", 2)}`;
	for (const id of recipientIds) {
		text += `\n${userMention(id)} +1 XP`;
		if (id === seconderDisplayName) {
			text += ` ${italic("Critical Toast!")}`;
		}
	}
	if (rankUpdates.length > 0) {
		text += `\n${heading("Rank Ups", 2)}\n- ${rankUpdates.join("\n- ")}`;
	}
	if (rewardTexts.length > 0) {
		text += `\n${heading("Rewards", 2)}\n- ${rewardTexts.join("\n- ")}`;
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
			rewardTexts.push(`${congratulationBuilder()}, ${userMention(id)}! You've risen to ${bold(rankName)}!`);
		}
	}
	return rewardTexts;
}

module.exports = {
	commandMention,
	congratulationBuilder,
	generateTextBar,
	getNumberEmoji,
	listifyEN,
	ihpAuthorPayload: { name: "Click here to check out the Imaginary Horizons GitHub", iconURL: "https://images-ext-2.discordapp.net/external/8DllSg9z_nF3zpNliVC3_Q8nQNu9J6Gs0xDHP_YthRE/https/cdn.discordapp.com/icons/353575133157392385/c78041f52e8d6af98fb16b8eb55b849a.png", url: "https://github.com/Imaginary-Horizons-Productions" },
	randomFooterTip,
	buildBountyEmbed,
	generateBountyRewardString,
	buildVersionEmbed,
	generateBountyBoardButtons,
	sendAnnouncement,
	buildCompanyLevelUpLine,
	seasonalScoreboardEmbed,
	overallScoreboardEmbed,
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
	formatSeasonResultsToRewardTexts
};
