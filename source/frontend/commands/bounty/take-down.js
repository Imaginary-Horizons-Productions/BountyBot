const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { commandMention, selectOptionsFromBounties, butIgnoreInteractionCollectorErrors, getBountyBoardThread } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { bountyTakeDown } = require("../../shared/flows/bountyTakeDown");
const { ensureHunterHasOpenBounty } = require("../_earlyOuts");

module.exports = new SubcommandWrapper("take-down", "Take down one of your bounties without awarding XP (forfeit posting XP)",
	ensureHunterHasOpenBounty(async function executeSubcommand(interaction, theater, isDevMode, logicLayer, bounties) {
		interaction.reply({
			content: `If you'd like to change the title, description, image, or time of your bounty instead, you can use ${commandMention("bounty edit")}.`,
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a bounty to take down...")
						.setOptions(selectOptionsFromBounties(bounties))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const [bountyId] = collectedInteraction.values;
			const bounty = await logicLayer.bounties.findBounty(bountyId);

			const bountyThread = await getBountyBoardThread(collectedInteraction.guild, theater.company.bountyBoardId, bounty.postingId);
			bountyTakeDown(logicLayer, collectedInteraction.guild, bounty, theater.hunter, bountyThread);
			collectedInteraction.reply({ content: "Your bounty has been taken down.", flags: MessageFlags.Ephemeral });
		}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		})
	})
);
