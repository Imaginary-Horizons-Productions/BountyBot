const { AutoModerationActionType, GuildMember, TextChannel } = require("discord.js");
const { butIgnoreMissingPermissionErrors, butIgnoreCantDirectMessageThisUserErrors } = require("./dAPIResponses");

/** @file Validations - Checks for issues with user input data */

/** Simulate auto mod actions for texts input to BountyBot
 * @param {TextChannel} channel
 * @param {GuildMember} member
 * @param {string[]} texts
 * @param {string} context
 * @returns whether or not any of the texts included something the auto mod blocks as a message
 */
async function textsHaveAutoModInfraction(channel, member, texts, context) {
	let autoModRules;
	try {
		autoModRules = await channel.guild.autoModerationRules.fetch();
	} catch (e) {
		// If you cannot fetch the auto mod rules, you likely do not have the Manage Server permission
		// Returning null to note this state to consumers of this function
		return null;
	}
	let shouldBlockMessage = false;
	for (const rule of autoModRules.values()) {
		if (rule.exemptChannels.has(channel.id)) {
			continue;
		}
		if (rule.exemptRoles.hasAny(member.roles.cache.keys())) {
			continue;
		}

		const hasRegexTrigger = texts.some(text => rule.triggerMetadata.regexPatterns.some(regex => new RegExp(regex).test(text)));
		const hasKeywordFilter = texts.some(text => rule.triggerMetadata.keywordFilter.some(regex => new RegExp(regex).test(text)));
		const hasAllowListFilter = texts.some(text => rule.triggerMetadata.allowList.some(regex => new RegExp(regex).test(text)))
		//TODO #94 fetch Discord presets from enum
		const exceedsMentionLimit = texts.some(text => {
			text.match(/<@[\d&]+>/)?.length > rule.triggerMetadata.mentionTotalLimit
		});
		if (((hasRegexTrigger || hasKeywordFilter) && !hasAllowListFilter) || exceedsMentionLimit) {
			for (const action of rule.actions) {
				switch (action.type) {
					case AutoModerationActionType.SendAlertMessage:
						if (action.metadata.channelId) {
							const alertChannel = await channel.guild.channels.fetch(action.metadata.channelId);
							alertChannel.send(`${member} tripped AutoMod in a ${context} with text(s): ${texts.join(", ")}`);
						}
						break;
					case AutoModerationActionType.Timeout:
						member.timeout(action.metadata.durationSeconds * 1000, `AutoMod timeout in a ${context} with texts: ${texts.join(", ")}`)
							.catch(butIgnoreMissingPermissionErrors);
						break;
					case AutoModerationActionType.BlockMessage:
						member.send(action.metadata.customMessage || `Your ${context} could not be completed because it tripped AutoMod.`)
							.catch(butIgnoreCantDirectMessageThisUserErrors);
						shouldBlockMessage = true;
						break;
				}
			}
		}
	}
	return shouldBlockMessage;
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

module.exports = {
	textsHaveAutoModInfraction,
	validateScheduledEventTimestamps
};
