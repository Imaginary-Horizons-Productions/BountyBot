const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { Item } = require("../classes");
const { SKIP_INTERACTION_HANDLING } = require("../constants");
const { bountiesToSelectOptions } = require("../util/messageComponentUtil");
const { timeConversion } = require("../util/textUtil");

const itemName = "Bounty Thumbnail";
module.exports = new Item(itemName, "Adds an image (via URL) to one of your open bounties!", 3000,
	async (interaction, database) => {
		const openBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.user.id, state: "open" } });
		if (openBounties.length < 1) {
			interaction.reply({ content: "You don't have any open bounties on this server to add a thumbnail to.", ephemeral: true });
			return true;
		}
		interaction.showModal(
			new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
				.setTitle("Add Bounty Thumbnail")
				.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder().setCustomId("imageURL")
							.setLabel("Image URL")
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
					interaction.reply({ content: `${imageURL} is not usable as a URL for a bounty thumbnail.`, ephemeral: true });
					return true;
				}
			}

			modalSubmission.reply({
				content: `A bounty's thumbnail will be shown on the bounty board and in the bounty's embed. It will also increase the XP you receive when the bounty's completed by 1.\n${imageURL}`,
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
							.setPlaceholder("Select a bounty...")
							.setOptions(bountiesToSelectOptions(openBounties))
					)
				],
				ephemeral: true,
				fetchReply: true
			}).then(reply => {
				const collector = reply.createMessageComponentCollector({ max: 1 });
				collector.on("collect", async collectedInteraction => {
					const bounty = await database.models.Bounty.findByPk(collectedInteraction.values[0]);
					if (bounty?.state !== "open") {
						collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", ephemeral: true });
						return;
					}
					bounty.thumbnailURL = imageURL;
					await bounty.save().then(async bounty => {
						bounty.reload();
						const company = await database.models.Company.findByPk(interaction.guildId);
						bounty.updatePosting(interaction.guild, company, database);
					});
					collectedInteraction.reply({ content: `The thumbnail on ${bounty.title} has been updated.${bounty.postingId !== null ? ` <#${bounty.postingId}>` : ""}`, ephemeral: true });
				})

				collector.on("end", interactionCollection => {
					modalSubmission.deleteReply();
				})
			})
		})
	}
);
