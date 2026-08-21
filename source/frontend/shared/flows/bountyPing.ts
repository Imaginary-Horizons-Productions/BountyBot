import { MessageFlags, ModalSubmitInteraction, ThreadChannel, userMention } from "discord.js";
import type { DatabaseTypes } from "../../../database";
import { BountyState } from "../../../shared/types.ts";

export async function bountyPing(modalSubmission: ModalSubmitInteraction, labelIds: { message: string; excludedBountyHunters: string; }, bounty: DatabaseTypes.Bounty, bountyThread: ThreadChannel | null) {
	if (!bounty || bounty.state !== BountyState.Open) {
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

	if (modalSubmission.channel.sendable) {
		modalSubmission.reply({ content: `${Array.from(interestedHunterIds.values()).map(id => userMention(id))} ${modalSubmission.fields.getTextInputValue(labelIds.message)}` });
	}
}
