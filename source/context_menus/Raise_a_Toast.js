const { InteractionContextType, PermissionFlagsBits, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { raiseToast } = require('../engines/toastEngine');
const { textsHaveAutoModInfraction } = require('../util/textUtil');

const mainId = "Raise a Toast";
module.exports = new UserContextMenuWrapper(mainId, PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	/** Open a modal to receive toast text, then raise the toast to the user */
	(interaction, database, runMode) => {
		if (interaction.targetId === interaction.user.id) {
			interaction.reply({ content: "You cannot raise a toast to yourself.", ephemeral: true });
			return;
		}

		if (interaction.targetUser.bot) {
			interaction.reply({ content: "You cannot raist a toast to a bot.", ephemeral: true });
			return;
		}

		const modalId = `${SKIP_INTERACTION_HANDLING}${interaction.id}`;
		interaction.showModal(new ModalBuilder().setCustomId(modalId)
			.setTitle("Raising a Toast")
			.addComponents(
				new ActionRowBuilder().addComponents(
					new TextInputBuilder().setCustomId("message")
						.setLabel("Toast Message")
						.setStyle(TextInputStyle.Short)
				)
			)
		);
		interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modalId, time: 300000 }).then(async modalSubmission => {
			const toastText = modalSubmission.fields.getTextInputValue("message");
			if (await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [toastText], "toast")) {
				modalSubmission.reply({ content: "Your toast was blocked by AutoMod.", ephemeral: true });
				return;
			}

			raiseToast(modalSubmission, database, [interaction.targetId], toastText);
		})
	}
);
