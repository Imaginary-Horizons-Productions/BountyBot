const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { commandMention, selectOptionsFromBounties, refreshEvergreenBountiesThread, butIgnoreInteractionCollectorErrors } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { Company } = require("../../../database/models");
const { ensureCompanyHasEnoughOpenEvergreenBounties } = require("../_earlyOuts");

module.exports = new SubcommandWrapper("take-down", "Take down one of the server's Evergreen Bounties",
	ensureCompanyHasEnoughOpenEvergreenBounties(1, async function executeSubcommand(interaction, theater, isDevMode, logicLayer, evergreenBounties) {
		interaction.reply({
			content: `If you'd like to change the title, description, or image of an evergreen bounty instead, you can use ${commandMention("evergreen edit")}.`,
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a bounty to take down...")
						.setOptions(selectOptionsFromBounties(evergreenBounties))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const [bountyId] = collectedInteraction.values;
			const [bounty] = evergreenBounties.splice(evergreenBounties.findIndex(bounty => bounty.id === bountyId), 1);
			logicLayer.bounties.deleteBountyCompletions(bountyId);
			if (theater.company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(theater.company.bountyBoardId);
				if (evergreenBounties.length > 0) {
					const currentCompanyLevel = Company.getLevel(theater.company.getXP(await logicLayer.hunters.getCompanyHunterMap(theater.company.id)));
					const hunterIdMap = {};
					for (const bounty of evergreenBounties) {
						hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
					}
					refreshEvergreenBountiesThread(bountyBoard, evergreenBounties, theater.company, currentCompanyLevel, interaction.guild.members.me, hunterIdMap);
				} else {
					bountyBoard.threads.fetch(theater.company.evergreenThreadId).then(thread => {
						thread.delete(`Last Evergreen Bounty taken down by ${interaction.member}`);
						theater.company.update({ evergreenThreadId: null });
					});
				}
			} else if (!collectedInteraction.member.manageable) {
				interaction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
			}
			bounty.destroy();

			collectedInteraction.update({ content: "The evergreen bounty has been taken down.", components: [] });
		}).catch(butIgnoreInteractionCollectorErrors);
	})
);
