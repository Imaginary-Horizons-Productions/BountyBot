const { MessageFlags, userMention, bold, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, LabelBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { sentenceListEN, refreshBountyThreadStarterMessage, selectOptionsFromBounties, commandMention, butIgnoreUnknownChannelErrors, butIgnoreInteractionCollectorErrors } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");

module.exports = new SubcommandWrapper("revoke-turn-ins", "Revoke the turn-ins of up to 5 bounty hunters on one of your bounties",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
		if (openBounties.length < 1) {
			interaction.reply({ content: `You don't currently have any open bounties. Post one with ${commandMention("bounty post")}?`, flags: MessageFlags.Ephemeral });
			return;
		}

		const labelIdBountyId = "bounty-id";
		const labelIdBountyHunters = "bounty-hunters";
		const maxHunters = 10;
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Revoke Bounty Turn-Ins")
			.addLabelComponents(
				new LabelBuilder().setLabel("Bounty")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
							.setPlaceholder("Select a bounty...")
							.setOptions(selectOptionsFromBounties(openBounties))
					),
				new LabelBuilder().setLabel("Bounty Hunters")
					.setUserSelectMenuComponent(
						new UserSelectMenuBuilder().setCustomId(labelIdBountyHunters)
							.setPlaceholder(`Select up to ${maxHunters} bounty hunters...`)
							.setMaxValues(maxHunters)
					)
			);
		await interaction.showModal(modal);
		const modalSubmission = await interaction.awaitModalSubmit({ filter: interaction => interaction.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
			.catch(butIgnoreInteractionCollectorErrors);
		if (!modalSubmission) {
			return;
		}

		const bounty = await logicLayer.bounties.findBounty(modalSubmission.fields.getStringSelectValues(labelIdBountyId)[0]);
		if (!bounty || bounty.state !== "open") {
			modalSubmission.reply({ content: "Your selected bounty could not be found.", flags: MessageFlags.Ephemeral });
			return;
		}

		const removedIds = modalSubmission.fields.getSelectedMembers(labelIdBountyHunters).map((_, key) => key);
		await logicLayer.bounties.deleteSelectedBountyCompletions(bounty.id, removedIds);
		const mentionList = sentenceListEN(removedIds.map(id => userMention(id)));
		modalSubmission.reply({ content: `These bounty hunters' turn-ins of ${bold(bounty.title)} have been revoked: ${mentionList}`, flags: MessageFlags.Ephemeral });

		const post = await refreshBountyThreadStarterMessage(modalSubmission.guild, origin.company, bounty, await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents), modalSubmission.member, origin.hunter.getLevel(origin.company.xpCoefficient), await logicLayer.bounties.getHunterIdSet(bounty.id))
			.catch(butIgnoreUnknownChannelErrors);
		if (post) {
			post.channel.send({ content: `${mentionList} ${removedIds.length === 1 ? "has had their turn-in" : "have had their turn-ins"} revoked.` });
		}
	}
);
