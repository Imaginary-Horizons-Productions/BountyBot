import { InteractionReplyOptions, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { DatabaseTypes } from "../../../database";
import { timeConversion } from "../../../shared";
import { SKIP_INTERACTION_HANDLING } from "../../../shared/constants";
import { BountyState } from "../../../shared/types";
import { SubcommandFunctionality } from "../../classes";
import { bountyEmbed, butIgnoreInteractionCollectorErrors, selectOptionsFromBounties } from "../../shared";
import { ensureCompanyHasEnoughOpenEvergreenBounties } from "../_earlyOuts";

export default new SubcommandFunctionality("showcase", "Show the embed for an evergreen bounty",
	ensureCompanyHasEnoughOpenEvergreenBounties(1, async function executeSubcommand(interaction, theater, isDevMode, logicLayer, evergreenBounties) {
		const labelIdBountyId = "bounty-id";
		const labelIdCustomMessage = "custom-message";
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Showcase an Evergreen Bounty")
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent("Unlike normal bounty showcases, an evergreen showcase does not increase the reward of the showcased bounty and is not rate-limited.")
			)
			.addLabelComponents(
				new LabelBuilder().setLabel("Bounty")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
							.setPlaceholder("Select a bounty...")
							.setOptions(selectOptionsFromBounties(evergreenBounties))
					),
				new LabelBuilder().setLabel("Custom Message")
					.setTextInputComponent(
						new TextInputBuilder().setCustomId(labelIdCustomMessage)
							.setStyle(TextInputStyle.Paragraph)
							.setPlaceholder("Add a custom message to the showcase...")
							.setRequired(false)
					)
			);
		await interaction.showModal(modal);
		const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
			.catch(butIgnoreInteractionCollectorErrors);
		if (!modalSubmission) {
			return;
		}

		const bounty = await logicLayer.bounties.findBounty(modalSubmission.fields.getStringSelectValues(labelIdBountyId)[0]);
		if (bounty?.state !== BountyState.Open) {
			modalSubmission.reply({ content: "The bounty you selected appears to have been taken-down before the showcase could resolve.", flags: MessageFlags.Ephemeral });
			return;
		}

		const currentCompanyLevel = DatabaseTypes.Company.getLevel(theater.company.getXP(await logicLayer.hunters.getCompanyHunterMap(theater.company.id)));
		const payload: InteractionReplyOptions = { embeds: [bountyEmbed(bounty, modalSubmission.guild.members.me, currentCompanyLevel, false, theater.company, new Set())] };
		const extraText = modalSubmission.fields.getTextInputValue(labelIdCustomMessage);
		if (extraText) {
			payload.content = extraText;
		}
		if (!modalSubmission.memberPermissions?.has(PermissionFlagsBits.MentionEveryone)) {
			payload.allowedMentions = { parse: [] };
		}
		modalSubmission.reply(payload);
	})
);
