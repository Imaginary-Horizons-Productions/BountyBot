const { InteractionContextType, MessageFlags, ModalBuilder, LabelBuilder, FileUploadBuilder } = require("discord.js");
const { SKIP_INTERACTION_HANDLING } = require('../../constants');
const { CommandWrapper } = require("../classes");
const { timeConversion } = require('../../shared');

const mainId = "config-user-thumbnails-premium";
const imageFieldToPayloadPropertyAndMessage = new Map(Object.entries({
	"toast-thumbnail": {
		payloadProperty: "toastThumbnailURL",
		messageStub: "toast thumbnail",
		description: "Set an image to use as thumbnail on toasts",
		modalLabel: "Toast Thumbnail"
	},
	"open-bounty-thumbnail": {
		payloadProperty: "openBountyThumbnailURL",
		messageStub: "open bounty thumbnail",
		description: "Set an image to use as thumbnail on open bounties",
		modalLabel: "Open Bounty Thumbnail"
	},
	"completed-bounty-thumbnail": {
		payloadProperty: "completedBountyThumbnailURL",
		messageStub: "completed bounty thumbnail",
		description: "Set an image to use as thumbnail on completed bounties",
		modalLabel: "Completed Bounty Thumbnail"
	},
	"deleted-bounty-thumbnail": {
		payloadProperty: "deletedBountyThumbnailURL",
		messageStub: "deleted bounty thumbnail",
		description: "Set an image to use as thumbnail on deleted bounties",
		modalLabel: "Deleted Bounty Thumbnail"
	}
}));
module.exports = new CommandWrapper(mainId, "Configure premium thumbnails for BountyBot on this server", null, true, [InteractionContextType.Guild], 3000,
	async (interaction, origin, runMode) => {
		const modalLabelComponents = [];
		for (const imageField of imageFieldToPayloadPropertyAndMessage.keys()) {
			const { description, modalLabel } = imageFieldToPayloadPropertyAndMessage.get(imageField);
			modalLabelComponents.push(new LabelBuilder().setLabel(modalLabel).setDescription(description)
				.setFileUploadComponent(
					new FileUploadBuilder().setCustomId(imageField)
						.setRequired(false)
				))
		}
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`).setTitle("Configure User Thumnbails").addLabelComponents(modalLabelComponents);
		
		interaction.showModal(modal);
		const modalInteraction = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") });
		const updatePayload = {};

		let replyContent = "The following thumbnails have been configured:";

		for (const imageField of imageFieldToPayloadPropertyAndMessage.keys()) {
			const { payloadProperty, messageStub } = imageFieldToPayloadPropertyAndMessage.get(imageField);
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
