import { LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, userMention, UserSelectMenuBuilder } from "discord.js";
import { SKIP_INTERACTION_HANDLING } from "../../../shared/constants.ts";
import { timeConversion } from "../../../shared/index.ts";
import { BountyState } from "../../../shared/types.ts";
import { SelectOptionFunctionality } from "../../classes/index.ts";
import { bountyEmbed, butIgnoreInteractionCollectorErrors, sentenceListEN, unarchiveAndUnlockThread } from "../../shared/index.ts";
import { ensureBountyExistsAndInteractorIsPoster } from "./_earlyOuts.ts";

export default new SelectOptionFunctionality("revoketurnin",
	ensureBountyExistsAndInteractorIsPoster(
		async (interaction, theater, isDevMode, logicLayer, [bounty]) => {
			const labelIdBountyHunters = "bounty-hunters";
			const maxHunters = 10;
			const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
				.setTitle("Revoke Bounty Turn-Ins")
				.addLabelComponents(
					new LabelBuilder().setLabel("Bounty Hunters")
						.setUserSelectMenuComponent(
							new UserSelectMenuBuilder().setCustomId(labelIdBountyHunters)
								.setPlaceholder(`Select up to ${maxHunters} bounty hunters...`)
								.setMaxValues(maxHunters)
						)
				);
			await interaction.showModal(modal);
			const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
				.catch(butIgnoreInteractionCollectorErrors);
			if (!modalSubmission) {
				return;
			}

			// Unnecessary Validations: "bounty existence", "posting thread existence"; if a bounty thread (or the bounty, which cascades the delete to the thread) is deleted while its modal is open, the modal does not submit
			await bounty.reload();
			if (bounty.state !== BountyState.Open) {
				modalSubmission.reply({ content: "This bounty no longer appears to be open.", flags: MessageFlags.Ephemeral });
				return;
			}

			const removedIds = modalSubmission.fields.getSelectedMembers(labelIdBountyHunters).map((_, key) => key);
			await logicLayer.bounties.deleteSelectedBountyCompletions(bounty.id, removedIds);

			if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
				modalSubmission.message.edit({ embeds: [bountyEmbed(bounty, modalSubmission.member, theater.hunter.getLevel(theater.company.xpCoefficient), false, theater.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
				await unarchiveAndUnlockThread(modalSubmission.channel, "bounty turn-ins revoked by poster");
			}
			if (modalSubmission.channel.sendable) {
				modalSubmission.reply({ content: `${sentenceListEN(removedIds.map(id => userMention(id)))} ${removedIds.length === 1 ? "has" : "have"} been removed as ${removedIds.length === 1 ? "a completer" : "completers"} of this bounty.` });
			}
		}
	)
);
