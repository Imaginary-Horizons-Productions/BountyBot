import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from "discord.js";
import { SKIP_INTERACTION_HANDLING } from "../../../shared/constants.ts";
import { SelectOptionFunctionality } from "../../classes/index.ts";
import { bountyTakeDown } from "../../shared/flows/bountyTakeDown.ts";
import { butIgnoreInteractionCollectorErrors } from "../../shared/index.ts";
import { ensureBountyExistsAndInteractorIsPoster } from "./_earlyOuts.ts";

export default new SelectOptionFunctionality("takedown",
	ensureBountyExistsAndInteractorIsPoster(
		async (interaction, theater, isDevMode, logicLayer, [bounty]) => {
			interaction.reply({
				content: `Really take down this bounty?`,
				components: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}confirm`)
							.setStyle(ButtonStyle.Success)
							.setEmoji("✔")
							.setLabel("Confirm")
					)
				],
				flags: MessageFlags.Ephemeral,
				withResponse: true
			}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.Button })).then(async collectedInteraction => {
				await collectedInteraction.update({ content: "Your bounty has been taken down.", components: [] });
				bountyTakeDown(logicLayer, collectedInteraction.guild, bounty, theater.hunter, collectedInteraction.channel);
			}).catch(butIgnoreInteractionCollectorErrors);
		}
	)
);
