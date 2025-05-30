const { ActionRowBuilder, UserSelectMenuBuilder, userMention, DiscordjsErrorCodes, ComponentType, MessageFlags } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../../constants.js');
const { timeConversion } = require('../../shared');
const { buildBountyEmbed, listifyEN, congratulationBuilder, generateBountyBoardButtons } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "bbaddcompleters";
module.exports = new ButtonWrapper(mainId, 3000,
	async (interaction, origin, runMode, [bountyId]) => {
		const bounty = await logicLayer.bounties.findBounty(bountyId);
		if (!bounty) {
			interaction.reply({ content: "This bounty appears to no longer exist. Has this bounty already been completed?", flags: MessageFlags.Ephemeral })
		}
		if (bounty.userId !== interaction.user.id) {
			interaction.reply({ content: "Only the bounty poster can add completers.", flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.reply({
			content: "Which bounty hunters should be credited with completing the bounty?",
			components: [
				new ActionRowBuilder().addComponents(
					new UserSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
						.setPlaceholder("Select bounty hunters...")
						.setMaxValues(5)
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: timeConversion(2, "m", "ms"), componentType: ComponentType.UserSelect })).then(async collectedInteraction => {
			const { eligibleTurnInIds, newTurnInIds, bannedTurnInIds } = await logicLayer.bounties.checkTurnInEligibility(bounty, Array.from(collectedInteraction.members.values()), runMode);
			if (newTurnInIds.size < 1) {
				collectedInteraction.reply({ content: `No new turn-ins were able to be recorded. You cannot credit yourself or bots for your own bounties. ${bannedTurnInIds.length ? ' The completer(s) mentioned are currently banned.' : ''}`, flags: MessageFlags.Ephemeral });
				return;
			}

			await logicLayer.bounties.bulkCreateCompletions(bounty.id, bounty.companyId, Array.from(eligibleTurnInIds), null);
			if (!collectedInteraction.channel) return;
			if (collectedInteraction.channel.archived) {
				await collectedInteraction.channel.setArchived(false, "Unarchived to update posting");
			}
			collectedInteraction.channel.send({ content: `${listifyEN(Array.from(newTurnInIds.values().map(id => userMention(id))))} ${newTurnInIds.size === 1 ? "has" : "have"} turned in this bounty! ${congratulationBuilder()}!` });
			const starterMessage = await collectedInteraction.channel.fetchStarterMessage();
			starterMessage.edit({
				embeds: [await buildBountyEmbed(bounty, collectedInteraction.guild, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, eligibleTurnInIds)],
				components: generateBountyBoardButtons(bounty)
			});
			return collectedInteraction.update({
				components: []
			});
		}).catch(error => {
			if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
				console.error(error);
			}
		}).finally(() => {
			// If the bounty thread was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		});
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
