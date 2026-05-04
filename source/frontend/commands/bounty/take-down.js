const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { commandMention, selectOptionsFromBounties, syncRankRoles, butIgnoreInteractionCollectorErrors, butIgnoreUnknownChannelErrors } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { bountyTakeDown } = require("../../shared/flows/bountyTakeDown");

module.exports = new SubcommandWrapper("take-down", "Take down one of your bounties without awarding XP (forfeit posting XP)",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
		if (openBounties.length < 1) {
			interaction.reply({ content: "You don't have any open bounties to take down.", flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.reply({
			content: `If you'd like to change the title, description, image, or time of your bounty instead, you can use ${commandMention("bounty edit")}.`,
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a bounty to take down...")
						.setOptions(selectOptionsFromBounties(openBounties))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const [bountyId] = collectedInteraction.values;
			const bounty = await logicLayer.bounties.findBounty(bountyId);

			let bountyThread;
			if (origin.company.bountyBoardId && bounty.postingId) {
				const bountyBoard = await collectedInteraction.guild.channels.fetch(origin.company.bountyBoardId);
				bountyThread = await bountyBoard.threads.fetch(bounty.postingId).catch(butIgnoreUnknownChannelErrors);
			}

			bountyTakeDown(logicLayer, collectedInteraction.guild, bounty, origin.hunter, bountyThread);
			collectedInteraction.reply({ content: "Your bounty has been taken down.", flags: MessageFlags.Ephemeral });
		}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		})
	}
);
