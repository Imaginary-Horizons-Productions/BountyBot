const { InteractionContextType, PermissionFlagsBits, ModalBuilder, userMention, bold, MessageFlags, LabelBuilder, StringSelectMenuBuilder } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../../constants');
const { commandMention, randomCongratulatoryPhrase, bountyEmbed, unarchiveAndUnlockThread, butIgnoreInteractionCollectorErrors, selectOptionsFromBounties } = require('../shared');
const { timeConversion } = require('../../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "Record Bounty Turn-In";
module.exports = new UserContextMenuWrapper(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive bounty slot number, then add the target user as a completer of the given bounty */
	async (interaction, origin, runMode) => {
		if (interaction.targetId === origin.hunter.userId) {
			interaction.reply({ content: "You cannot credit yourself with completing your own bounty.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (runMode === "production" && interaction.targetUser.bot) {
			interaction.reply({ content: "You cannot credit a bot with completing your bounty.", flags: MessageFlags.Ephemeral });
			return;
		}

		const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(interaction.targetId, origin.company.id);
		if (hunter.isBanned) {
			interaction.reply({ content: `${userMention(interaction.targetId)} cannot be credited with bounty completion because they are banned from interacting with BountyBot on this server.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const bounties = await logicLayer.bounties.findOpenBounties(origin.hunter.userId, origin.company.id);
		if (bounties.length < 1) {
			interaction.reply({ content: "You don't appear to have any open bounties.", flags: MessageFlags.Ephemeral });
			return;
		}

		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Record a Bounty Turn-In")
			.setLabelComponents(
				new LabelBuilder().setLabel(`Bounty Hunter: ${interaction.targetMember.displayName}`)
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId("bounty-id")
							.setPlaceholder("Select a bounty...")
							.setOptions(selectOptionsFromBounties(bounties))
					)
			)
		interaction.showModal(modal);
		return interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
			const [bountyId] = modalSubmission.fields.getStringSelectValues("bounty-id");
			const bounty = await logicLayer.bounties.findBounty(bountyId);
			if (bounty?.state !== "open") {
				modalSubmission.reply({ content: "The bounty you selected no longer appears to be open.", flags: MessageFlags.Ephemeral });
				return;
			}
			await logicLayer.bounties.bulkCreateCompletions(bountyId, bounty.companyId, [interaction.targetId], null);
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
