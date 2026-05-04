const { ModalBuilder, LabelBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, MessageFlags, TextInputBuilder, TextInputStyle, userMention, ModalSubmitInteraction } = require("discord.js");
const { selectOptionsFromBounties, butIgnoreInteractionCollectorErrors } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { InteractionOrigin } = require("../../classes");
const { Bounty } = require("../../../database/models");

/**
 * @param {typeof import("../../../logic")} logicLayer
 * @param {ModalSubmitInteraction} modalSubmission
 * @param {{ message: string; excludedBountyHunters: string; }} labelIds
 * @param {Bounty} bounty
 * @param {string | null} bountyBoardId
 * @param {import("discord.js").ForumThreadChannel | undefined} bountyThread
 */
async function bountyPing(logicLayer, modalSubmission, labelIds, bounty, bountyBoardId, bountyThread) {
	if (!bounty || bounty.state !== "open") {
		modalSubmission.reply({ content: "Your selected bounty could not be found.", flags: MessageFlags.Ephemeral });
		return;
	}
	const interestedHunterIds = new Set();
	if (!bountyThread && bountyBoardId && bounty.postingId) {
		const bountyBoard = await modalSubmission.guild.channels.fetch(bountyBoardId);
		if (bountyBoard) {
			bountyThread = await bountyBoard.threads.fetch(bounty.postingId);
		}
	}
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
			for (const [id, user] of subscribers) {
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

	modalSubmission.reply({ content: `${Array.from(interestedHunterIds.values()).map(id => userMention(id))} ${modalSubmission.fields.getTextInputValue(labelIds.message)}` });
}

module.exports = {
	bountyPing
};
