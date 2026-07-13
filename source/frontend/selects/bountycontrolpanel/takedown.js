const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ComponentType } = require("discord.js");
const { SelectOptionWrapper } = require("../../classes");
const { ensureBountyExistsAndInteractorIsPoster } = require("./_earlyOuts");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { butIgnoreInteractionCollectorErrors } = require("../../shared");
const { bountyTakeDown } = require("../../shared/flows/bountyTakeDown");

module.exports = new SelectOptionWrapper("takedown",
	ensureBountyExistsAndInteractorIsPoster(
		async (interaction, theater, isDevMode, logicLayer, [bounty]) => {
			interaction.reply({
				content: `Really take down this bounty?`,
				components: [
					new ActionRowBuilder().addComponents(
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
