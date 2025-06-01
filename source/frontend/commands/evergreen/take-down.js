const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { commandMention, bountiesToSelectOptions, buildBountyEmbed } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");

module.exports = new SubcommandWrapper("take-down", "Take down one of your bounties without awarding XP (forfeit posting XP)",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const openBounties = await logicLayer.bounties.findEvergreenBounties(interaction.guild.id);
		interaction.reply({
			content: `If you'd like to change the title, description, or image of an evergreen bounty, you can use ${commandMention("evergreen edit")} instead.`,
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a bounty to take down...")
						.setMaxValues(1)
						.setOptions(bountiesToSelectOptions(openBounties))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const [bountyId] = collectedInteraction.values;
			const [bounty] = openBounties.splice(openBounties.findIndex(bounty => bounty.id === bountyId), 1);
			bounty.state = "deleted";
			bounty.save();
			logicLayer.bounties.deleteBountyCompletions(bountyId);
			if (openBounties.length > 0) {
				const currentCompanyLevel = origin.company.getLevel(await logicLayer.hunters.findCompanyHunters(interaction.guild.id));
				const embeds = await Promise.all(openBounties.map(bounty => buildBountyEmbed(bounty, interaction.guild, currentCompanyLevel, false, origin.company, new Set())));
				if (origin.company.bountyBoardId) {
					const bountyBoard = await interaction.guild.channels.fetch(origin.company.bountyBoardId);
					bountyBoard.threads.fetch(origin.company.evergreenThreadId).then(async thread => {
						const message = await thread.fetchStarterMessage();
						message.edit({ embeds });
					});
				}
			} else if (origin.company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(origin.company.bountyBoardId);
				bountyBoard.threads.fetch(origin.company.evergreenThreadId).then(thread => {
					thread.delete(`Evergreen bounty taken down by ${interaction.member}`);
					origin.company.evergreenThreadId = null;
					origin.company.save();
				});
			}
			bounty.destroy();

			collectedInteraction.reply({ content: "The evergreen bounty has been taken down.", flags: MessageFlags.Ephemeral });
		}).catch(error => {
			if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
				console.error(error);
			}
		}).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		});
	}
);
