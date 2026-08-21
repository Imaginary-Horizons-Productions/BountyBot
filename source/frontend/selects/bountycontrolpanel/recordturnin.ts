import { LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, userMention, UserSelectMenuBuilder } from "discord.js";
import { SKIP_INTERACTION_HANDLING } from "../../../shared/constants.ts";
import { timeConversion } from "../../../shared/index.ts";
import { BountyState } from "../../../shared/types.ts";
import { SelectOptionFunctionality } from "../../classes/index.ts";
import { bountyEmbed, butIgnoreInteractionCollectorErrors, randomCongratulatoryPhrase, sentenceListEN, unarchiveAndUnlockThread } from "../../shared/index.ts";
import { ensureBountyExistsAndInteractorIsPoster } from "./_earlyOuts.ts";

export default new SelectOptionFunctionality("recordturnin",
	ensureBountyExistsAndInteractorIsPoster(
		async (interaction, theater, isDevMode, logicLayer, [bounty]) => {
			const labelIdBountyHunters = "bounty-hunters";
			const maxHunters = 10;
			const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
				.setTitle("Record Bounty Turn-Ins")
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

			const { eligibleTurnInIds, newTurnInIds, bannedTurnInIds } = await logicLayer.bounties.checkTurnInEligibility(bounty, Array.from(modalSubmission.fields.getSelectedMembers(labelIdBountyHunters).values()), isDevMode);
			if (newTurnInIds.size < 1) {
				modalSubmission.reply({ content: `No new turn-ins were able to be recorded. You cannot credit yourself or bots for your own bounties. ${bannedTurnInIds.length ? ' The completer(s) mentioned are currently banned.' : ''}`, flags: MessageFlags.Ephemeral });
				return;
			}

			await logicLayer.bounties.bulkCreateCompletions(bounty.id, bounty.companyId, Array.from(eligibleTurnInIds), null);

			if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
				modalSubmission.message.edit({ embeds: [bountyEmbed(bounty, modalSubmission.member, theater.hunter.getLevel(theater.company.xpCoefficient), false, theater.company, eligibleTurnInIds, await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
				await unarchiveAndUnlockThread(modalSubmission.channel, "bounty turn-ins recorded by poster");
			}
			if (modalSubmission.channel.sendable) {
				modalSubmission.reply({ content: `${sentenceListEN(Array.from(newTurnInIds.values().map(id => userMention(id))))} ${newTurnInIds.size === 1 ? "has" : "have"} turned in this bounty! ${randomCongratulatoryPhrase()}!` });
			}
		}
	)
);
