const { PermissionFlagsBits, InteractionContextType, MessageFlags, ModalBuilder, LabelBuilder, FileUploadBuilder } = require("discord.js");
const { SKIP_INTERACTION_HANDLING } = require('../../constants');
const { CommandWrapper } = require("../classes");
const { timeConversion } = require('../../shared');

const mainId = "config-server-thumbnails-premium";
const imageFieldToPayloadPropertyAndMessage = new Map(Object.entries({
	"scoreboard-thumbnail": {
		payloadProperty: "scoreboardThumbnailURL",
		messageStub: "scoreboard thumbnail",
		description: "Set an image to use as thumbnail on the scoreboard",
		modalLabel: "Scoreboard Thumbnail"
	},
	"goal-completion-thumbnail": {
		payloadProperty: "goalCompletionThumbnailURL",
		messageStub: "goal completion thumbnail",
		description: "Set an image to use as thumbnail in server goal completion messages",
		modalLabel: "Goal Completion Thumbnail"
	},
	"raffle-thumbnail": {
		payloadProperty: "raffleThumbnailURL",
		messageStub: "raffle thumbnail",
		description: "Set an image to use as thumbnail in raffle winner messages",
		modalLabel: "Raffle Thumbnail"
	}
}));
module.exports = new CommandWrapper(mainId, "Configure thumbnails for server messages (Premium)", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	async (interaction, origin, runMode) => {
		const modalLabelComponents = [];
		for (const [ imageField, { description, modalLabel }  ] of imageFieldToPayloadPropertyAndMessage.keys()) {
			modalLabelComponents.push(new LabelBuilder().setLabel(modalLabel).setDescription(description)
				.setFileUploadComponent(
					new FileUploadBuilder().setCustomId(imageField)
						.setRequired(false)
				))
		}
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`).setTitle("Configure Server Thumbnails").addLabelComponents(modalLabelComponents);
		
		interaction.showModal(modal);
		const modalInteraction = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") });
		const updatePayload = {};

		let replyContent = "The following thumbnails have been configured:";

		for (const [ imageField, { payloadProperty, messageStub } ] of imageFieldToPayloadPropertyAndMessage.keys()) {
			const thumbnailCollection = modalInteraction.fields.getUploadedFiles(imageField);
			if (thumbnailCollection) {
				const firstAttachment = thumbnailCollection.first();
				if (firstAttachment) {
					updatePayload[payloadProperty] = firstAttachment.url;
					replyContent += `\n- The ${messageStub} was set to <${firstAttachment.url}>.`;
				}
			}
		}

		origin.company.update(updatePayload);
		modalInteraction.reply({ content: replyContent, flags: MessageFlags.Ephemeral });
	}
);
