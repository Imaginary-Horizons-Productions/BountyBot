const { InteractionContextType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, userMention, bold, MessageFlags, LabelBuilder } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../../constants');
const { commandMention, randomCongratulatoryPhrase, bountyEmbed, unarchiveAndUnlockThread, butIgnoreInteractionCollectorErrors } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "Record Bounty Turn-In";
module.exports = new UserContextMenuWrapper(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive bounty slot number, then add the target user as a completer of the given bounty */
	async (interaction, origin, runMode) => {
		if (interaction.targetId === interaction.user.id) {
			interaction.reply({ content: "You cannot credit yourself with completing your own bounty.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (runMode === "production" && interaction.targetUser.bot) {
			interaction.reply({ content: "You cannot credit a bot with completing your bounty.", flags: MessageFlags.Ephemeral });
			return;
		}

		const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(interaction.targetId, interaction.guild.id);
		if (hunter.isBanned) {
			interaction.reply({ content: `${userMention(interaction.targetId)} cannot be credited with bounty completion because they are banned from interacting with BountyBot on this server.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const modalId = `${SKIP_INTERACTION_HANDLING}${interaction.id}`;
		interaction.showModal(new ModalBuilder().setCustomId(modalId)
			.setTitle("Select a Bounty")
			.setLabelComponents(
				new LabelBuilder().setLabel("Bounty Slot Number")
					.setTextInputComponent(
						new TextInputBuilder().setCustomId("slot-number")
							.setStyle(TextInputStyle.Short)
					)
			)
		);
		return interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modalId, time: 300000 }).then(async modalSubmission => {
			const slotNumber = modalSubmission.fields.getTextInputValue("slot-number");
			const bounty = await logicLayer.bounties.findBounty({ slotNumber, userId: interaction.user.id, companyId: modalSubmission.guild.id });
			if (!bounty) {
				modalSubmission.reply({ content: `You don't appear to have an open bounty in slot ${slotNumber}.`, flags: MessageFlags.Ephemeral });
				return;
			}
			await logicLayer.bounties.bulkCreateCompletions(bounty.id, bounty.companyId, [interaction.targetId], null);
			const boardId = origin.company.bountyBoardId;
			const { postingId } = bounty;
			if (boardId && postingId) {
				const boardChannel = await modalSubmission.guild.channels.fetch(boardId);
				const post = await boardChannel.threads.fetch(postingId);
				await unarchiveAndUnlockThread(post, "Unarchived to update posting");
				post.send({ content: `${userMention(interaction.targetId)} has turned-in this bounty! ${randomCongratulatoryPhrase()}!` });
				(await post.fetchStarterMessage()).edit({ embeds: [await bountyEmbed(bounty, modalSubmission.guild, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, new Set([interaction.targetId]))] });
			}
			modalSubmission.reply({ content: `${userMention(interaction.targetId)}'s turn-in of ${bold(bounty.title)} has been recorded! They will recieve the reward XP when you ${commandMention("bounty complete")}.`, flags: MessageFlags.Ephemeral });
		}).catch(butIgnoreInteractionCollectorErrors);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
