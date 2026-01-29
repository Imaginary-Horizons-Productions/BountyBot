const fs = require("fs");
const { SelectMenuLimits, MessageLimits, EmbedLimits, ModalLimits } = require("@sapphire/discord.js-utilities");
const { Bounty, Rank, Company, Participation, Hunter, Season, Completion, Toast } = require("../../database/models");
const { Role, Collection, AttachmentBuilder, ActionRowBuilder, UserSelectMenuBuilder, userMention, EmbedBuilder, Guild, StringSelectMenuBuilder, underline, italic, Colors, MessageFlags, GuildMember, ButtonBuilder, ButtonStyle, GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, bold } = require("discord.js");
const { SKIP_INTERACTION_HANDLING, bountyBotIconURL, discordIconURL, SAFE_DELIMITER, COMPANY_XP_COEFFICIENT } = require("../../constants");
const { emojiFromNumber, sentenceListEN, fillableTextBar, randomCongratulatoryPhrase } = require("./stringConstructors");
const { descendingByProperty } = require("../../shared");

/** @file Discord API (dAPI) Serializers - changes our data into the shapes dAPI wants */

//#region Serialization Utilities - modifies a given entity
// Naming Convention: describe modifications, don't match other conventions

/**
 * @param {string} text
 * @param {number} length
 */
function truncateTextToLength(text, length) {
	if (text.length > length) {
		return `${text.slice(0, length - 1)}…`;
	} else {
		return text;
	}
}

/** Checks if the given `content` fits in a Discord message and attaches it as a file if it doesn't
 * @param {string} content
 * @param {import("discord.js").BaseMessageOptionsWithPoll} messageOptions
 * @param {string} filename
 */
function attachOverflowingContentAsFile(content, messageOptions, filename) {
	if (content.length < MessageLimits.MaximumLength) {
		messageOptions.content = content;
	} else {
		messageOptions.files = [new AttachmentBuilder(Buffer.from(content, 'utf16le'), { name: filename })];
	}
	return messageOptions;
}

/** Apply the company's announcement prefix to the message (bots suppress notifications through flags instead of starting with "@silent")
 * @param {Company} company
 * @param {import('discord.js').MessageCreateOptions} messageOptions
 */
function addCompanyAnnouncementPrefix(company, messageOptions) {
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
//#endregion

//#region Serializers - returns whole entities
// Naming Convention: `${outputType}From${inputType}`

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
].map(text => ({ text, iconURL: bountyBotIconURL }));
const tipPool = bountyBotTips.concat(bountyBotTips, discordTips);

/** twice as likely to roll an application specific tip as a discord tip */
function randomFooterTip() {
	return tipPool[Math.floor(Math.random() * tipPool.length)];
}

/** @param {string} placeholderText */
function disabledSelectRow(placeholderText) {
	return new ActionRowBuilder().addComponents(
		new UserSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
			.setPlaceholder(truncateTextToLength(placeholderText, SelectMenuLimits.MaximumPlaceholderCharacters))
			.setDisabled(true)
	)
}

/** @param {string} bountyId */
function bountyControlPanelSelectRow(bountyId) {
	return [
		new ActionRowBuilder().addComponents(
			new StringSelectMenuBuilder().setCustomId(`bountycontrolpanel${SAFE_DELIMITER}${bountyId}`)
				.setPlaceholder("Select a bounty command...")
				.setOptions(
					{ label: "No Change", description: "You can move the selection to this option without changing anything", value: "nochange" },
					{ emoji: "📥", label: "Record other hunters' turn-ins", description: "Confirm another hunter has turned-in this bounty", value: "recordturnin" },
					{ emoji: "🚫", label: "Revoke other hunters' turn-ins", description: "Remove credit for turning in this bounty from another hunter", value: "revoketurnin" },
					{ emoji: "🔝", label: "Showcase this bounty", description: "Increase the rewards on this bounty and promote it in another channel", value: "showcase" },
					{ emoji: "✅", label: "Complete this bounty", description: "Distribute rewards for turn-ins and mark this bounty completed", value: "complete" },
					{ emoji: "📝", label: "Edit this bounty", description: "Change details about this bounty", value: "edit" },
					{ emoji: "🔄", label: "Swap this bounty to another slot", description: "Move this bounty to another slot, changing its base reward", value: "swap" },
					{ emoji: "🗑️", label: "Take this bounty down", description: "Take this bounty down without distrbuting rewards", value: "takedown" }
				)
		)
	]
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
function bountyScheduledEventPayload(title, posterName, slotNumber, description, imageURL, startTimestamp, endTimestamp) {
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

/** @param {Bounty[]} bounties */
function selectOptionsFromBounties(bounties) {
	return bounties.map(bounty => {
		const optionPayload = {
			emoji: emojiFromNumber(bounty.slotNumber),
			label: bounty.title,
			value: bounty.id
		}
		if (bounty.description) {
			optionPayload.description = truncateTextToLength(bounty.description, SelectMenuLimits.MaximumLengthOfDescriptionOfOption);
		}
		return optionPayload;
	}).slice(0, SelectMenuLimits.MaximumOptionsLength);
}

/**
 * @param {Rank[]} ranks
 * @param {Collection<string, Role>} allGuildRoles
 */
function selectOptionsFromRanks(ranks, allGuildRoles) {
	return ranks.map((rank, index) => {
		const option = {
			label: rank.roleId ? allGuildRoles.get(rank.roleId).name : `Rank ${index + 1}`,
			description: `Variance Threshold: ${rank.threshold}`,
			value: rank.threshold.toString()
		};
		if (rank.rankmoji) {
			option.emoji = rank.rankmoji;
		}
		return option;
	}).slice(0, SelectMenuLimits.MaximumOptionsLength);
}

/**
 * @param {Bounty} bounty
 * @param {boolean} isEvergreen
 * @param {string} key for constructing the ModalBuilder's customId uniquely
 * @param {Guild} guild
 */
async function editBountyModalAndSubmissionOptions(bounty, isEvergreen, key, guild) {
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

/** The version embed lists the following: changes in the most recent update, known issues in the most recent update, and links to support the project */
async function latestVersionChangesEmbed() {
	const changelogPath = "./ChangeLog.md";
	const data = await fs.promises.readFile(changelogPath, { encoding: 'utf8' });
	const stats = await fs.promises.stat(changelogPath);
	const dividerRegEx = /## .+ Version/g;
	const changesStartRegEx = /\.\d+[cfi]*:/g;
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
		.setTitle(`${guild.name} is ${underline(`Level ${currentCompanyLevel}`)}`)
		.setThumbnail(guild.iconURL())
		.setDescription(`${fillableTextBar(companyXP - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}${italic("Next Level:")} ${nextLevelThreshold - companyXP} Bounty Hunter Levels`)
		.addFields(
			{ name: "Total Bounty Hunter Level", value: `${companyXP} level${companyXP == 1 ? "" : "s"}`, inline: true },
			{ name: "Participation", value: `${participantCount} server members have interacted with BountyBot this season (${particpantPercentage.toPrecision(3)}% of server members)` },
			{ name: `${currentSeasonXP} XP Earned Total (${seasonXPDifference === 0 ? "same as last season" : `${seasonXPDifference > 0 ? `+${seasonXPDifference} more XP` : `${seasonXPDifference * -1} fewer XP`} than last season`})`, value: `${currentSeason.bountiesCompleted} bounties (${seasonBountyDifference === 0 ? "same as last season" : `${seasonBountyDifference > 0 ? bold(`+${seasonBountyDifference} more bounties`) : bold(`${seasonBountyDifference * -1} fewer bounties`)} than last season`})\n${currentSeason.toastsRaised} toasts (${seasonToastDifference === 0 ? "same as last season" : `${seasonToastDifference > 0 ? bold(`+${seasonToastDifference} more toasts`) : bold(`${seasonToastDifference * -1} fewer toasts`)} than last season`})` }
		)
		.setFooter(randomFooterTip())
		.setTimestamp()
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
	const maxDescriptionLength = EmbedLimits.MaximumDescriptionLength - andMore.length;
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
		fields.push({ name: "Server Goal", value: `${fillableTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
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
	for (const guildMember of Array.from(hunterMembers.values()).sort(descendingByProperty("xp"))) {
		const hunter = hunterMap.get(guildMember.id);
		if (hunter?.xp < 1) {
			break;
		}
		scorelines.push(`${bold(guildMember.displayName)} ${underline(`Level ${hunter.getLevel(company.xpCoefficient)}`)} ${italic(`${hunter.xp} XP`)}`);
	}
	const embed = new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setThumbnail(company.scoreboardThumbnailURL)
		.setTitle("The Scoreboard")
		.setFooter(randomFooterTip())
		.setTimestamp();
	let description = "";
	const andMore = "…and more";
	const maxDescriptionLength = EmbedLimits.MaximumDescriptionLength - andMore.length;
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
		fields.push({ name: "Server Goal", value: `${fillableTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
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
 * @param {Hunter} targetHunter
 * @param {GuildMember} targetGuildMember
 * @param {number} currentLevel
 * @param {number} currentLevelThreshold
 * @param {number} nextLevelThreshold
 * @param {Participation} currentParticipation
 * @param {string} rankName
 * @param {Participation[]} previousParticipations
 * @param {Toast} mostSecondedToast
 */
function hunterProfileEmbed(targetHunter, targetGuildMember, currentLevel, currentLevelThreshold, nextLevelThreshold, currentParticipation, rankName, previousParticipations, mostSecondedToast) {
	return new EmbedBuilder().setColor(Colors[targetHunter.profileColor])
		.setAuthor(module.exports.ihpAuthorPayload)
		.setThumbnail(targetGuildMember.user.avatarURL())
		.setTitle(`${targetGuildMember.displayName} is ${underline(`Level ${currentLevel}`)}`)
		.setDescription(`${fillableTextBar(targetHunter.xp - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}\nThey have earned ${italic(`${currentParticipation?.xp ?? 0} XP`)} this season${currentParticipation.rankIndex !== null ? ` which qualifies for ${rankName}` : ""}.`)
		.addFields(
			{ name: "Season Placements", value: `Currently: ${(currentParticipation?.placement ?? 0) === 0 ? "Unranked" : "#" + currentParticipation.placement}\n${previousParticipations.length > 0 ? `Previous Placements: ${previousParticipations.map(participation => `#${participation.placement}`).join(", ")}` : ""}`, inline: true },
			{ name: "Total XP Earned", value: `${targetHunter.xp} XP`, inline: true },
			{ name: "Most Seconded Toast", value: mostSecondedToast ? `"${mostSecondedToast.text}" with ${bold(`${mostSecondedToast.secondings} secondings`)}` : "No toasts seconded yet..." },
			{ name: "Bounty Stats", value: `Bounties Hunted: ${targetHunter.othersFinished} bount${targetHunter.othersFinished === 1 ? 'y' : 'ies'}\nBounty Postings: ${targetHunter.mineFinished} bount${targetHunter.mineFinished === 1 ? 'y' : 'ies'}`, inline: true },
			{ name: "Toast Stats", value: `Toasts Raised: ${targetHunter.toastsRaised} toast${targetHunter.toastsRaised === 1 ? "" : "s"}\nToasts Seconded: ${targetHunter.toastsSeconded} toast${targetHunter.toastsSeconded === 1 ? "" : "s"}\nToasts Recieved: ${targetHunter.toastsReceived} toast${targetHunter.toastsReceived === 1 ? "" : "s"}`, inline: true },
		)
		.setFooter(randomFooterTip())
		.setTimestamp()
}

/** Generate an embed for the given bounty
 * @param {Bounty} bounty
 * @param {Guild} guild
 * @param {number} posterLevel
 * @param {boolean} shouldOmitRewardsField
 * @param {Company} company
 * @param {Set<string>} hunterIdSet
 */
async function bountyEmbed(bounty, guild, posterLevel, shouldOmitRewardsField, company, hunterIdSet) {
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
		fields.push({ name: "Time", value: `${discordTimestamp(event.scheduledStartTimestamp / 1000)} - ${discordTimestamp(event.scheduledEndTimestamp / 1000)}` });
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
		const completersFieldText = sentenceListEN(Array.from(hunterIdSet.values().map(id => userMention(id))));
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
 * @param {string} thumbnailURL
 * @param {string} toastText
 * @param {Set<string>} recipientIdSet
 * @param {GuildMember} senderMember
 */
function toastEmbed(thumbnailURL, toastText, recipientIdSet, senderMember) {
	return new EmbedBuilder().setColor("e5b271")
		.setThumbnail(thumbnailURL)
		.setTitle(toastText)
		.setDescription(`A toast to ${sentenceListEN(Array.from(recipientIdSet).map(id => userMention(id)))}!`)
		.setFooter({ text: senderMember.displayName, iconURL: senderMember.user.avatarURL() });
}

/** @param {string} toastId */
function secondingButtonRow(toastId) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`secondtoast${SAFE_DELIMITER}${toastId}`)
			.setLabel("Hear, hear!")
			.setEmoji("🥂")
			.setStyle(ButtonStyle.Primary)
	)
}

/** @param {string[]} contributorIds */
function goalCompletionEmbed(contributorIds) {
	return new EmbedBuilder().setColor("e5b271")
		.setTitle("Server Goal Completed")
		.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
		.setDescription(`${randomCongratulatoryPhrase()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
		.addFields({ name: "Contributors", value: sentenceListEN(contributorIds.map(id => userMention(id))) })
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
 * @param {Hunter} hunter
 * @param {Guild} guild
 * @param {GuildMember} member
 * @param {number} dqCount
 * @param {(Bounty & {Completions: Completion[]})[]} lastFiveBounties
 */
function userReportEmbed(hunter, guild, member, dqCount, lastFiveBounties) {
	const embed = new EmbedBuilder().setColor(member.displayColor)
		.setAuthor({ name: guild.name, iconURL: guild.iconURL() })
		.setTitle(`Moderation Stats: ${member.user.tag}`)
		.setThumbnail(member.user.avatarURL())
		.setDescription(`Display Name: ${bold(member.displayName)} (id: ${italic(member.id)})\nAccount created on: ${member.user.createdAt.toDateString()}\nJoined server on: ${member.joinedAt.toDateString()}`)
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
		bountyHistory += underline(bounty.title);
		if (bounty.description !== null) {
			bountyHistory += ` ${bounty.description}`;
		}
		bountyHistory += `${sentenceListEN(bounty.Completions.map(completion => `\n${userMention(completion.userId)} +${completion.xpAwarded} XP`))}\n\n`;
	}

	if (bountyHistory === "") {
		bountyHistory = "No recent bounties";
	}
	return embed.addFields({ name: "Last 5 Completed Bounties Created by this User", value: bountyHistory });
}
//#endregion

module.exports = {
	truncateTextToLength,
	attachOverflowingContentAsFile,
	addCompanyAnnouncementPrefix,
	ihpAuthorPayload: { name: "Click here to check out the Imaginary Horizons GitHub", iconURL: "https://images-ext-2.discordapp.net/external/8DllSg9z_nF3zpNliVC3_Q8nQNu9J6Gs0xDHP_YthRE/https/cdn.discordapp.com/icons/353575133157392385/c78041f52e8d6af98fb16b8eb55b849a.png", url: "https://github.com/Imaginary-Horizons-Productions" },
	randomFooterTip,
	disabledSelectRow,
	bountyControlPanelSelectRow,
	bountyScheduledEventPayload,
	selectOptionsFromBounties,
	selectOptionsFromRanks,
	editBountyModalAndSubmissionOptions,
	latestVersionChangesEmbed,
	companyStatsEmbed,
	seasonalScoreboardEmbed,
	overallScoreboardEmbed,
	hunterProfileEmbed,
	bountyEmbed,
	toastEmbed,
	secondingButtonRow,
	goalCompletionEmbed,
	raffleResultEmbed,
	userReportEmbed
}
