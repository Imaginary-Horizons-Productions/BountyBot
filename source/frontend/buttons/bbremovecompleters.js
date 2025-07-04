const { ActionRowBuilder, UserSelectMenuBuilder, DiscordjsErrorCodes, ComponentType, MessageFlags } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../../constants');
const { listifyEN, buildBountyEmbed, generateBountyBoardButtons } = require('../shared');
const { timeConversion } = require('../../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "bbremovecompleters";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, origin, runMode, [bountyId]) => {
		logicLayer.bounties.findBounty(bountyId).then(async bounty => {
			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty poster can remove completers.", flags: MessageFlags.Ephemeral });
				return;
			}

			interaction.reply({
				content: "Which bounty hunters should be removed from bounty credit?",
				components: [
					new ActionRowBuilder().addComponents(
						new UserSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}`)
							.setPlaceholder("Select bounty hunters...")
							.setMaxValues(5)
					)
				],
				flags: MessageFlags.Ephemeral,
				withResponse: true
			}).then(response => response.resource.message.awaitMessageComponent({ time: timeConversion(2, "m", "ms"), componentType: ComponentType.UserSelect })).then(async collectedInteraction => {
				const removedIds = collectedInteraction.members.map((_, key) => key);
				await logicLayer.bounties.deleteSelectedBountyCompletions(bountyId, removedIds);
				buildBountyEmbed(bounty, collectedInteraction.guild, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, await logicLayer.bounties.getHunterIdSet(bountyId))
					.then(async embed => {
						if (collectedInteraction.channel.archived) {
							await collectedInteraction.channel.setArchived(false, "completers removed from bounty");
						}
						interaction.message.edit({ embeds: [embed], components: generateBountyBoardButtons(bounty) })
					});

				collectedInteraction.channel.send({ content: `${listifyEN(removedIds.map(id => `<@${id}>`))} ${removedIds.length === 1 ? "has" : "have"} been removed as ${removedIds.length === 1 ? "a completer" : "completers"} of this bounty.` });
				return collectedInteraction.reply({ content: `The listed bounty hunter(s) will no longer recieve credit when this bounty is completed.`, flags: MessageFlags.Ephemeral });
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
		})
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
