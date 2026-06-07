import { bold, InteractionContextType, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder, userMention } from 'discord.js';
import { LogicLayer } from '../../logic';
import { timeConversion } from '../../shared';
import { SKIP_INTERACTION_HANDLING } from '../../shared/constants';
import { UserContextMenuFunctionality } from '../classes';
import { bountyEmbed, butIgnoreInteractionCollectorErrors, commandMention, getBountyBoardThread, randomCongratulatoryPhrase, selectOptionsFromBounties, unarchiveAndUnlockThread } from '../shared';

let logicLayer: LogicLayer;

const mainId = "Record Bounty Turn-In";
export default new UserContextMenuFunctionality(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive bounty slot number, then add the target user as a completer of the given bounty */
	async (interaction, theater, isDevMode) => {
		if (interaction.targetId === theater.hunter.userId) {
			interaction.reply({ content: "You cannot credit yourself with completing your own bounty.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (!isDevMode && interaction.targetUser.bot) {
			interaction.reply({ content: "You cannot credit a bot with completing your bounty.", flags: MessageFlags.Ephemeral });
			return;
		}

		const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(interaction.targetId, theater.company.id);
		if (hunter.isBanned) {
			interaction.reply({ content: `${userMention(interaction.targetId)} cannot be credited with bounty completion because they are banned from interacting with BountyBot on this server.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const bounties = await logicLayer.bounties.findOpenBounties(theater.hunter.userId, theater.company.id);
		if (bounties.length < 1) {
			interaction.reply({ content: "You don't appear to have any open bounties.", flags: MessageFlags.Ephemeral });
			return;
		}

		const labelIdBountyId = "bounty-id";
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Record a Bounty Turn-In")
			.setLabelComponents(
				new LabelBuilder().setLabel(`Bounty Hunter: ${interaction.targetMember.displayName}`)
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
							.setPlaceholder("Select a bounty...")
							.setOptions(selectOptionsFromBounties(bounties))
					)
			)
		interaction.showModal(modal);
		return interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
			const [bountyId] = modalSubmission.fields.getStringSelectValues(labelIdBountyId);
			const bounty = await logicLayer.bounties.findBounty(bountyId);
			if (bounty?.state !== "open") {
				modalSubmission.reply({ content: "The bounty you selected no longer appears to be open.", flags: MessageFlags.Ephemeral });
				return;
			}
			await logicLayer.bounties.bulkCreateCompletions(bountyId, bounty.companyId, [interaction.targetId], null);
			modalSubmission.reply({ content: `${userMention(interaction.targetId)}'s turn-in of ${bold(bounty.title)} has been recorded! They will recieve the reward XP when you ${commandMention("bounty complete")}.`, flags: MessageFlags.Ephemeral });

			const bountyThread = await getBountyBoardThread(modalSubmission.guild, theater.company.bountyBoardId, bounty.postingId);
			if (bountyThread) {
				if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
					(await bountyThread.fetchStarterMessage()).edit({ embeds: [bountyEmbed(bounty, interaction.member, theater.hunter.getLevel(theater.company.xpCoefficient), false, theater.company, new Set([interaction.targetId]), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
					await unarchiveAndUnlockThread(bountyThread, "bounty turn-in recorded by poster");
				}
				if (bountyThread.sendable) {
					bountyThread.send({ content: `${userMention(interaction.targetId)} has turned-in this bounty! ${randomCongratulatoryPhrase()}!` });
				}
			}
		}).catch(butIgnoreInteractionCollectorErrors);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
