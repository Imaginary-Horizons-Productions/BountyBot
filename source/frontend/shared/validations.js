const { AutoModerationActionType, GuildMember, TextChannel } = require("discord.js");
const { butIgnoreMissingPermissionErrors } = require("./dAPIResponses");

/** Simulate auto mod actions for texts input to BountyBot
 * @param {TextChannel} channel
 * @param {GuildMember} member
 * @param {string[]} texts
 * @param {string} context
 * @returns whether or not any of the texts included something the auto mod blocks as a message
 */
async function textsHaveAutoModInfraction(channel, member, texts, context) {
	const autoModRules = await channel.guild.autoModerationRules.fetch();
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
						member.send(action.metadata.customMessage || `Your ${context} could not be completed because it tripped AutoMod.`);
						shouldBlockMessage = true;
						break;
				}
			}
		}
	}
	return shouldBlockMessage;
}

module.exports = {
	textsHaveAutoModInfraction
};
