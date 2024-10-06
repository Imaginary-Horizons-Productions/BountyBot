const { InteractionContextType, PermissionFlagsBits, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, userMention, bold } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { addCompleters } = require('../engines/bountyEngine');
const { commandMention } = require('../util/textUtil');

const mainId = "Give Bounty Credit";
module.exports = new UserContextMenuWrapper(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive bounty slot number, then add the target user as a completer of the given bounty */
	async (interaction, database, runMode) => {
		if (interaction.targetId === interaction.user.id) {
			interaction.reply({ content: "You cannot credit yourself with completing your own bounty.", ephemeral: true });
			return;
		}

		if (runMode === "prod" && interaction.targetUser.bot) {
			interaction.reply({ content: "You cannot credit a bot with completing your bounty.", ephemeral: true });
			return;
		}

		await database.models.User.findOrCreate({ where: { id: interaction.targetId } });
		const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: interaction.targetId, companyId: interaction.guildId } });
		if (hunter.isBanned) {
			interaction.reply({ content: `${userMention(interaction.targetId)} cannot be credited with bounty completion because they are banned from interacting with BountyBot on this server.`, ephemeral: true });
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
				modalSubmission.reply({ content: `You don't appear to have an open bounty in slot ${slotNumber}.`, ephemeral: true });
				return;
			}

			addCompleters(modalSubmission.guild, database, bounty, bounty.Company, [interaction.targetId]);
			modalSubmission.reply({
				content: `${userMention(interaction.targetId)} has been added as a completers of ${bold(bounty.title)}! They will recieve the reward XP when you ${commandMention("bounty complete")}.`,
				ephemeral: true
			});
		})
	}
);
