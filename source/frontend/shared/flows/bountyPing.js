const { MessageFlags, userMention, ModalSubmitInteraction, ThreadChannel } = require("discord.js");
const { Bounty } = require("../../../database/models");
const { threadCanRecieveMessages } = require("../dAPIRequests");

/**
 * @param {ModalSubmitInteraction} modalSubmission
 * @param {{ message: string; excludedBountyHunters: string; }} labelIds
 * @param {Bounty} bounty
 * @param {ThreadChannel | null} bountyThread
 */
async function bountyPing(modalSubmission, labelIds, bounty, bountyThread) {
	if (!bounty || bounty.state !== "open") {
		modalSubmission.reply({ content: "Your selected bounty could not be found.", flags: MessageFlags.Ephemeral });
		return;
	}
	const interestedHunterIds = new Set();
	if (bountyThread) {
		// Using the force flag here because route through the bounty control panel didn't have reactions cached (discord.js bug?)
		const postingMessage = await bountyThread.fetchStarterMessage({ force: true });
		if (postingMessage) {
			const interestedReactionsManager = postingMessage.reactions.cache.get("👀");
			if (interestedReactionsManager) {
				for (const userSnowflake of (await interestedReactionsManager.users.fetch()).keys()) {
					interestedHunterIds.add(userSnowflake);
				}
			}
		}
	}

	if (bounty.scheduledEventId) {
		const scheduledEvent = await modalSubmission.guild.scheduledEvents.fetch(bounty.scheduledEventId);
		if (scheduledEvent) {
			const subscribers = await scheduledEvent.fetchSubscribers();
			for (const id of subscribers.keys()) {
				interestedHunterIds.add(id);
			}
		}
	}

	const excludedHuntersCollection = modalSubmission.fields.getSelectedUsers(labelIds.excludedBountyHunters);
	if (excludedHuntersCollection) {
		for (const id of excludedHuntersCollection.keys()) {
			interestedHunterIds.delete(id);
		}
	}

	if (threadCanRecieveMessages(modalSubmission.channel)) {
		modalSubmission.reply({ content: `${Array.from(interestedHunterIds.values()).map(id => userMention(id))} ${modalSubmission.fields.getTextInputValue(labelIds.message)}` });
	}
}

module.exports = {
	bountyPing
};
