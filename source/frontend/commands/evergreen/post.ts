import { EmbedLimits } from "@sapphire/discord.js-utilities";
import { FileUploadBuilder, LabelBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { DatabaseTypes } from "../../../database/index.ts";
import { MAX_EVERGREEN_SLOTS, SKIP_INTERACTION_HANDLING } from "../../../shared/constants.ts";
import { timeConversion } from "../../../shared/index.ts";
import { SubcommandFunctionality } from "../../classes/index.ts";
import { addCompanyAnnouncementPrefix, bountyEmbed, butIgnoreInteractionCollectorErrors, commandMention, refreshEvergreenBountiesThread, textsHaveAutoModInfraction } from "../../shared/index.ts";

export default new SubcommandFunctionality("post", `Post an evergreen bounty, limit ${MAX_EVERGREEN_SLOTS}`,
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const existingBounties = await logicLayer.bounties.findEvergreenBounties(interaction.guild.id);
		let slotNumber = null;
		for (let slotCandidate = 1; slotCandidate <= MAX_EVERGREEN_SLOTS; slotCandidate++) {
			if (!existingBounties.some(bounty => bounty.slotNumber === slotCandidate)) {
				slotNumber = slotCandidate;
				break;
			}
		}

		if (slotNumber === null) {
			interaction.reply({ content: `Each server can only have ${MAX_EVERGREEN_SLOTS} Evergreen Bounties.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const labelIdTitle = "title";
		const labelIdDescription = "description";
		const labelIdImage = "image";
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("New Evergreen Bounty")
			.addLabelComponents(
				new LabelBuilder().setLabel("Title")
					.setTextInputComponent(
						new TextInputBuilder().setCustomId(labelIdTitle)
							.setStyle(TextInputStyle.Short)
							.setPlaceholder("Most Discord markdown allowed...")
							.setMaxLength(EmbedLimits.MaximumTitleLength)
					),
				new LabelBuilder().setLabel("Description")
					.setDescription("A detailed description of the bounty.")
					.setTextInputComponent(
						new TextInputBuilder().setCustomId(labelIdDescription)
							.setStyle(TextInputStyle.Paragraph)
							.setPlaceholder("Bounties with clear instructions are easier to complete...")
					),
				new LabelBuilder().setLabel("Image")
					.setDescription("A diagram or splash image for the bounty.")
					.setFileUploadComponent(
						new FileUploadBuilder().setCustomId(labelIdImage)
							.setRequired(false)
					)
			);
		interaction.showModal(modal);

		return interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") }).then(async interaction => {
			const title = interaction.fields.getTextInputValue(labelIdTitle);
			const description = interaction.fields.getTextInputValue(labelIdDescription);

			const autoModInfraction = await textsHaveAutoModInfraction(interaction.channel, interaction.member, [title, description], "evergreen post");
			if (autoModInfraction == null) {
				interaction.reply({ content: `Could not check if the toast breaks automod rules. ${interaction.client.user} may not have the Manage Server permission required to check the automod rules.`, flags: MessageFlags.Ephemeral });
				return;
			} else if (autoModInfraction) {
				interaction.reply({ content: "Your evergreen bounty could not be posted because it tripped AutoMod.", flags: MessageFlags.Ephemeral });
				return;
			}

			const rawBounty: Partial<DatabaseTypes.Bounty> = {
				userId: interaction.client.user.id,
				companyId: interaction.guildId,
				slotNumber: parseInt(slotNumber),
				isEvergreen: true,
				title
			};
			if (description) {
				rawBounty.description = description;
			}

			const imageFileCollection = interaction.fields.getUploadedFiles(labelIdImage);
			if (imageFileCollection) {
				const firstAttachment = imageFileCollection.first();
				if (firstAttachment) {
					rawBounty.attachmentURL = firstAttachment.url;
				}
			}

			const bounty = await logicLayer.bounties.createBounty(rawBounty);
			existingBounties.push(bounty);

			// post in bounty board forum
			const currentCompanyLevel = DatabaseTypes.Company.getLevel(theater.company.getXP(await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id)));
			interaction.reply(addCompanyAnnouncementPrefix(theater.company, { content: `A new evergreen bounty has been posted:`, embeds: [bountyEmbed(bounty, interaction.guild.members.me, currentCompanyLevel, false, theater.company, new Set())] })).then(async () => {
				if (theater.company.bountyBoardId) {
					const hunterIdMap = {};
					for (const bounty of existingBounties) {
						hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
					}
					interaction.guild.channels.fetch(theater.company.bountyBoardId).then(bountyBoard => refreshEvergreenBountiesThread(bountyBoard, existingBounties, theater.company, currentCompanyLevel, interaction.guild.members.me, hunterIdMap)).then(thread => {
						bounty.postingId = thread.id;
						bounty.save()
					});
				} else if (!interaction.member.manageable) {
					interaction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
				}
			});
		}).catch(butIgnoreInteractionCollectorErrors);
	}
);
