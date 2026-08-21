import { type AnySelectMenuInteraction, MessageFlags } from "discord.js";
import type { DatabaseTypes } from "../../../database";
import type { LogicLayer } from "../../../logic";
import type { InteractionTheater } from "../../classes";

export function ensureBountyExistsAndInteractorIsPoster(next: (interaction: AnySelectMenuInteraction<"cached">, theater: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer, args: [bounty: DatabaseTypes.Bounty]) => Promise<void>) {
	return async (interaction: AnySelectMenuInteraction<"cached">, theater: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer, [bountyId]: [string]) => {
		const bounty = await logicLayer.bounties.findBounty(bountyId);
		if (!bounty) {
			interaction.reply({ content: "This bounty appears to no longer exist. Has this bounty already been completed?", flags: MessageFlags.Ephemeral })
			return;
		}
		if (bounty.userId !== interaction.user.id) {
			interaction.reply({ content: "Only the bounty's poster can use these commands.", flags: MessageFlags.Ephemeral });
			return;
		}
		next(interaction, theater, isDevMode, logicLayer, [bounty]);
	}
}
