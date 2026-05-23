const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, unorderedList } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { textsHaveAutoModInfraction, selectOptionsFromBounties, bountyEmbed, refreshEvergreenBountiesThread, editBountyModalAndSubmissionOptions, butIgnoreInteractionCollectorErrors } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { Company } = require("../../../database/models");
const { ensureCompanyHasEnoughOpenEvergreenBounties } = require("../_earlyOuts");

module.exports = new SubcommandWrapper("edit", "Change the name, description, or image of an evergreen bounty",
	ensureCompanyHasEnoughOpenEvergreenBounties(1, async function executeSubcommand(interaction, origin, runMode, logicLayer, evergreenBounties) {
		interaction.reply({
			content: "Editing an evergreen bounty will not change previous completions.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a bounty to edit...")
						.setOptions(selectOptionsFromBounties(evergreenBounties))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const [bountyId] = collectedInteraction.values;
			// Verify bounty exists
			const selectedBounty = evergreenBounties.find(bounty => bounty.id === bountyId);
			if (selectedBounty?.state !== "open") {
				interaction.update({ content: `There is no evergreen bounty #${bountyId}.`, components: [] });
				return;
			}

			const { modal, inputIds, submissionOptions } = editBountyModalAndSubmissionOptions(selectedBounty, await selectedBounty.get(collectedInteraction.guild.scheduledEvents), true, collectedInteraction.id);
			collectedInteraction.showModal(modal);
			return interaction.awaitModalSubmit(submissionOptions).then(async modalSubmission => {
				interaction.deleteReply();
				const title = modalSubmission.fields.getTextInputValue(inputIds.title);
				const description = modalSubmission.fields.getTextInputValue(inputIds.description);

				const errors = [];
				const autoModInfraction = await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "evergreen edit");
				if (autoModInfraction == null) {
					errors.push(`Could not check if the toast breaks automod rules. ${modalSubmission.client.user} may not have the Manage Server permission required to check the automod rules.`);
				} else if (autoModInfraction) {
					errors.push("The bounty's new title or description would trip this server's AutoMod.");
				}

				if (errors.length > 0) {
					modalSubmission.reply({ content: `The following errors were encountered while editing your bounty **${title}**:\n${unorderedList(errors)}`, flags: MessageFlags.Ephemeral });
					return;
				}

				const updatePayload = { editCount: selectedBounty.editCount + 1 };
				if (title) {
					updatePayload.title = title;
				}

				updatePayload.description = description;

				const imageAttachmentCollection = modalSubmission.fields.getUploadedFiles(inputIds.image);
				if (imageAttachmentCollection) {
					const firstAttachment = imageAttachmentCollection.first();
					if (firstAttachment) {
						updatePayload.attachmentURL = imageAttachmentCollection;
					} else {
						updatePayload.attachmentURL = null;
					}
				} else {
					updatePayload.attachmentURL = null;
				}

				selectedBounty.update(updatePayload);

				// update bounty board
				const currentCompanyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(modalSubmission.guild.id)));
				if (origin.company.bountyBoardId) {
					const hunterIdMap = {};
					for (const bounty of evergreenBounties) {
						hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
					}
					const bountyBoard = await modalSubmission.guild.channels.fetch(origin.company.bountyBoardId);
					refreshEvergreenBountiesThread(bountyBoard, evergreenBounties, origin.company, currentCompanyLevel, modalSubmission.guild.members.me, hunterIdMap);
				} else if (!modalSubmission.member.manageable) {
					interaction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
				}

				modalSubmission.reply({ content: "Here's the embed for the newly edited evergreen bounty:", embeds: [bountyEmbed(selectedBounty, modalSubmission.guild.members.me, currentCompanyLevel, false, origin.company, new Set())], flags: MessageFlags.Ephemeral });
			});
		}).catch(butIgnoreInteractionCollectorErrors);
	})
);
