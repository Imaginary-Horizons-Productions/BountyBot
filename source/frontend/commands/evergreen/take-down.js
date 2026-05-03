const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { commandMention, selectOptionsFromBounties, refreshEvergreenBountiesThread, butIgnoreInteractionCollectorErrors } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { Company } = require("../../../database/models");

module.exports = new SubcommandWrapper("take-down", "Take down one of the server's Evergreen Bounties",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const openBounties = await logicLayer.bounties.findEvergreenBounties(origin.company.id);
		interaction.reply({
			content: `If you'd like to change the title, description, or image of an evergreen bounty instead, you can use ${commandMention("evergreen edit")}.`,
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
			const [bounty] = openBounties.splice(openBounties.findIndex(bounty => bounty.id === bountyId), 1);
			logicLayer.bounties.deleteBountyCompletions(bountyId);
			if (origin.company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(origin.company.bountyBoardId);
				if (openBounties.length > 0) {
					const currentCompanyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(origin.company.id)));
					const hunterIdMap = {};
					for (const bounty of openBounties) {
						hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
					}
					refreshEvergreenBountiesThread(bountyBoard, openBounties, origin.company, currentCompanyLevel, interaction.guild.members.me, hunterIdMap);
				} else {
					bountyBoard.threads.fetch(origin.company.evergreenThreadId).then(thread => {
						thread.delete(`Last Evergreen Bounty taken down by ${interaction.member}`);
						origin.company.update({ evergreenThreadId: null });
					});
				}
			} else if (!collectedInteraction.member.manageable) {
				interaction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
			}
			bounty.destroy();

			collectedInteraction.update({ content: "The evergreen bounty has been taken down.", components: [] });
		}).catch(butIgnoreInteractionCollectorErrors);
	}
);
