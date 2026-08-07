import { ChatInputCommandInteraction, Colors, ContainerBuilder, FileUploadBuilder, heading, LabelBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, ModalBuilder, TextDisplayBuilder } from "discord.js";
import { DatabaseTypes } from "../../../database";
import { timeConversion } from "../../../shared";
import { SKIP_INTERACTION_HANDLING } from "../../../shared/constants";

export async function configCompanyThumbnails(thumbnailSetKind: string, thumbnailUpdateData: { label: string; description: string; payloadProperty: keyof DatabaseTypes.Company; }[], interaction: ChatInputCommandInteraction, company: DatabaseTypes.Company) {
	const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`).setTitle(`Configure ${thumbnailSetKind}s`);
	for (const { label, description, payloadProperty } of thumbnailUpdateData) {
		modal.addLabelComponents(
			new LabelBuilder().setLabel(label).setDescription(description)
				.setFileUploadComponent(
					new FileUploadBuilder().setCustomId(payloadProperty)
						.setRequired(false)
				)
		)
	}

	interaction.showModal(modal);
	const modalInteraction = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") });
	const updatePayload: Partial<DatabaseTypes.Company> = {};

	const container = new ContainerBuilder().setAccentColor(Colors.Blurple)
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(heading(`${thumbnailSetKind} Changes`)))

	const componentsForValidatedImages = [];
	for (const { label, payloadProperty } of thumbnailUpdateData) {
		const thumbnailCollection = modalInteraction.fields.getUploadedFiles(payloadProperty);
		if (thumbnailCollection) {
			const firstAttachment = thumbnailCollection.first();
			if (firstAttachment) {
				updatePayload[payloadProperty] = firstAttachment.url;
				componentsForValidatedImages.push([
					new TextDisplayBuilder().setContent(heading(label, 2)),
					new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(firstAttachment.url))
				]);
			}
		}
	}

	let resultMessage;
	if (componentsForValidatedImages.length > 0) {
		resultMessage = "The following thumbnails were updated:";
	} else {
		resultMessage = "No valid thumbnail images were received."
	}
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(resultMessage))

	for (const [textComponent, mediaGalleryComponent] of componentsForValidatedImages) {
		container.addTextDisplayComponents(textComponent)
			.addMediaGalleryComponents(mediaGalleryComponent);
	}

	company.update(updatePayload);
	modalInteraction.reply({ components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
}
