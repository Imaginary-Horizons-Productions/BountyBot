const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ComponentType, LabelBuilder } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { bountiesToSelectOptions, updatePosting, butIgnoreInteractionCollectorErrors } = require("../shared");
const { timeConversion } = require("../../shared");

/** @type {typeof import("../../logic")} */
let logicLayer;

const itemName = "Bounty Thumbnail";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "Adds an image (via URL) to one of your open bounties!", 3000,
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
						new LabelBuilder().setLabel("Image URL")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId("imageURL")
									.setStyle(TextInputStyle.Short)
							)
					)
			);

			return interaction.awaitModalSubmit({ filter: (incoming) => incoming.customId === `${SKIP_INTERACTION_HANDLING}${interaction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
				const imageURL = modalSubmission.fields.getTextInputValue("imageURL");
				if (imageURL) {
					try {
						new URL(imageURL);
					} catch (error) {
						interaction.reply({ content: `${imageURL} is not usable as a URL for a bounty thumbnail.`, flags: MessageFlags.Ephemeral });
						return true;
					}
				}

				return modalSubmission.reply({
					content: `A bounty's thumbnail will be shown on the bounty board and in the bounty's embed. It will also increase the XP you receive when the bounty's completed by 1.\n${imageURL}`,
					components: [
						new ActionRowBuilder().addComponents(
							new StringSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
								.setPlaceholder("Select a bounty...")
								.setOptions(bountiesToSelectOptions(openBounties))
						)
					],
					flags: MessageFlags.Ephemeral,
					withResponse: true
				}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
					const bounty = await openBounties.find(bounty => bounty.id === collectedInteraction.values[0]).reload();
					if (bounty?.state !== "open") {
						return collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
					}
					bounty.thumbnailURL = imageURL;
					await bounty.save().then(async bounty => {
						bounty.reload();
						const company = await logicLayer.companies.findCompanyByPK(interaction.guildId);
						updatePosting(interaction.guild, company, bounty, (await logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id)).getLevel(company.xpCoefficient), await logicLayer.bounties.getHunterIdSet(bounty.id));
					});
					return collectedInteraction.reply({ content: `The thumbnail on ${bounty.title} has been updated.${bounty.postingId !== null ? ` <#${bounty.postingId}>` : ""}`, flags: MessageFlags.Ephemeral });
				})
			}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
				modalSubmission.deleteReply();
			})
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
