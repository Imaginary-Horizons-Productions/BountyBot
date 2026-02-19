const { StringSelectMenuBuilder, ModalBuilder, MessageFlags, LabelBuilder, FileUploadBuilder, channelMention } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { selectOptionsFromBounties, refreshBountyThreadStarterMessage, butIgnoreInteractionCollectorErrors } = require("../shared");
const { timeConversion } = require("../../shared");

/** @type {typeof import("../../logic")} */
let logicLayer;

const itemName = "Bounty Thumbnail";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "Adds an image to one of your open bounties!", 3000,
		async (interaction, origin) => {
			const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
			if (openBounties.length < 1) {
				interaction.reply({ content: "You don't have any open bounties on this server to add a thumbnail to.", flags: MessageFlags.Ephemeral });
				return true;
			}
			interaction.showModal(
				new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setTitle("Add Bounty Thumbnail")
					.addLabelComponents(
						new LabelBuilder().setLabel("Bounty")
							.setStringSelectMenuComponent(
								new StringSelectMenuBuilder().setCustomId("bounty-id")
									.setPlaceholder("Select a bounty...")
									.setOptions(selectOptionsFromBounties(openBounties))
							),
						new LabelBuilder().setLabel("Image URL")
							.setFileUploadComponent(
								new FileUploadBuilder().setCustomId("imageURL")
									.setMaxValues(1)
							)
					)
			);

			return interaction.awaitModalSubmit({ filter: (incoming) => incoming.customId === `${SKIP_INTERACTION_HANDLING}${interaction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
				const bounty = await openBounties.find(bounty => bounty.id === modalSubmission.fields.getStringSelectValues("bounty-id")[0]).reload();
				if (bounty?.state !== "open") {
					return modalSubmission.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
				}

				const imageFileCollection = modalSubmission.fields.getUploadedFiles("imageURL", true);
				const firstAttachment = imageFileCollection.first();
				if (!firstAttachment) {
					return modalSubmission.reply({ content: "There was an error handling the submitted image.", flags: MessageFlags.Ephemeral });
				}

				await bounty.update({ thumbnailURL: firstAttachment.url }).then(async bounty => {
					refreshBountyThreadStarterMessage(interaction.guild, origin.company, bounty, (await logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id)).getLevel(origin.company.xpCoefficient), await logicLayer.bounties.getHunterIdSet(bounty.id));
				});
				return modalSubmission.reply({ content: `The thumbnail on ${bounty.title} has been updated.${bounty.postingId !== null ? ` ${channelMention(bounty.postingId)}` : ""}`, flags: MessageFlags.Ephemeral });
			}).catch(butIgnoreInteractionCollectorErrors);
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
