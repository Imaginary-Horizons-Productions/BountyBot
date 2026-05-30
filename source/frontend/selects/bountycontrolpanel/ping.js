const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, MessageFlags } = require("discord.js");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { SelectOptionWrapper } = require("../../classes");
const { timeConversion } = require("../../../shared");
const { butIgnoreInteractionCollectorErrors } = require("../../shared");
const { bountyPing } = require("../../shared/flows/bountyPing");
const { ensureBountyExistsAndInteractorIsPoster } = require("./_earlyOuts");

module.exports = new SelectOptionWrapper("ping",
	ensureBountyExistsAndInteractorIsPoster(
		async (interaction, theater, isDevMode, logicLayer, [bounty]) => {
			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty's poster can use these commands.", flags: MessageFlags.Ephemeral });
				return;
			}
			const labelIdMessage = "message";
			const labelIdExcludedBountyHunters = "bounty-hunters";
			const maxHunters = 10;
			const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
				.setTitle("Ping Interested Bounty Hunters")
				.addLabelComponents(
					new LabelBuilder().setLabel("Message")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId(labelIdMessage)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Add a message to go with the ping...")
						),
					new LabelBuilder().setLabel("Hunters to Exclude")
						.setUserSelectMenuComponent(
							new UserSelectMenuBuilder().setCustomId(labelIdExcludedBountyHunters)
								.setPlaceholder(`Select up to ${maxHunters} bounty hunters...`)
								.setMaxValues(maxHunters)
								.setRequired(false)
						)
				);
			await interaction.showModal(modal);
			const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
				.catch(butIgnoreInteractionCollectorErrors);
			if (!modalSubmission) {
				return;
			}

			bounty = await logicLayer.bounties.findBounty(bounty.id);
			if (!bounty || bounty.state !== "open") {
				modalSubmission.reply({ content: "Your selected bounty could not be found.", flags: MessageFlags.Ephemeral });
				return;
			}

			bountyPing(modalSubmission, { message: labelIdMessage, excludedBountyHunters: labelIdExcludedBountyHunters }, bounty, interaction.channel);
		}
	)
);
