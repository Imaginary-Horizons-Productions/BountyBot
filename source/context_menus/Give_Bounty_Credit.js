const { InteractionContextType, PermissionFlagsBits, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, userMention, bold, MessageFlags, Guild } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { commandMention, listifyEN, congratulationBuilder } = require('../util/textUtil');
const { Completion } = require('../models/bounties/Completion.js');
const { Bounty } = require('../models/bounties/Bounty.js');
const { Company } = require('../models/companies/Company.js');
const { Hunter } = require('../models/users/Hunter.js');

/** @type {typeof import("../logic")} */
let logicLayer;

/**
 * Updates the board posting for the bounty after adding the completers
 * @param {Bounty} bounty
 * @param {Company} company
 * @param {Hunter} poster
 * @param {string[]} newCompleterIds
 * @param {Completion[]} completers
 * @param {Guild} guild
 */
async function updateBoardPosting(bounty, company, poster, newCompleterIds, completers, guild) {
	let boardId = company.bountyBoardId;
	let { postingId } = bounty;
	if (!boardId || !postingId) return;
	let boardsChannel = await guild.channels.fetch(boardId);
	let post = await boardsChannel.threads.fetch(postingId);
	if (post.archived) {
		await thread.setArchived(false, "Unarchived to update posting");
	}
	post.edit({ name: bounty.title });
	let numCompleters = newCompleterIds.length;
	post.send({ content: `${listifyEN(newCompleterIds.map(id => userMention(id)))} ${numCompleters === 1 ? "has" : "have"} been added as ${numCompleters === 1 ? "a completer" : "completers"} of this bounty! ${congratulationBuilder()}!` });
	let starterMessage = await post.fetchStarterMessage();
	starterMessage.edit({
		embeds: [await bounty.embed(guild, poster.level, false, company, completers)],
		components: bounty.generateBountyBoardButtons()
	});
}

const mainId = "Give Bounty Credit";
module.exports = new UserContextMenuWrapper(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive bounty slot number, then add the target user as a completer of the given bounty */
	async (interaction, database, runMode) => {
		if (interaction.targetId === interaction.user.id) {
			interaction.reply({ content: "You cannot credit yourself with completing your own bounty.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		if (runMode === "prod" && interaction.targetUser.bot) {
			interaction.reply({ content: "You cannot credit a bot with completing your bounty.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(interaction.targetId, interaction.guild.id);
		if (hunter.isBanned) {
			interaction.reply({ content: `${userMention(interaction.targetId)} cannot be credited with bounty completion because they are banned from interacting with BountyBot on this server.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const modalId = `${SKIP_INTERACTION_HANDLING}${interaction.id}`;
		interaction.showModal(new ModalBuilder().setCustomId(modalId)
			.setTitle("Select a Bounty")
			.addComponents(
				new ActionRowBuilder().addComponents(
					new TextInputBuilder().setCustomId("slot-number")
						.setLabel("Bounty Slot Number")
						.setStyle(TextInputStyle.Short)
				)
			)
		);
		interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modalId, time: 300000 }).then(async modalSubmission => {
			const slotNumber = modalSubmission.fields.getTextInputValue("slot-number");
			const bounty = await database.models.Bounty.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber: slotNumber, state: "open" }, include: database.models.Bounty.Company });
			if (!bounty) {
				modalSubmission.reply({ content: `You don't appear to have an open bounty in slot ${slotNumber}.`, flags: [MessageFlags.Ephemeral] });
				return;
			}

			let { bounty: returnedBounty, allCompleters, poster, company } = await logicLayer.bounties.addCompleters(modalSubmission.guild, bounty, [interaction.targetId]);
			updateBoardPosting(returnedBounty, company, poster, [interaction.targetId], allCompleters, modalSubmission.guild);
			modalSubmission.reply({ content: `${userMention(interaction.targetId)} has been added as a completers of ${bold(bounty.title)}! They will recieve the reward XP when you ${commandMention("bounty complete")}.`, flags: [MessageFlags.Ephemeral] });
		})
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
