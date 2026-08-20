import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from "discord.js";
import { SKIP_INTERACTION_HANDLING } from "../../../shared/constants";
import { SelectOptionFunctionality } from "../../classes";
import { butIgnoreInteractionCollectorErrors } from "../../shared";
import { bountyTakeDown } from "../../shared/flows/bountyTakeDown";
import { ensureBountyExistsAndInteractorIsPoster } from "./_earlyOuts";

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
