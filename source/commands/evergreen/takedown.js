const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { Sequelize } = require("sequelize");
const { commandMention } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const openBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
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
		flags: [MessageFlags.Ephemeral],
		withResponse: true
	}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
		const [bountyId] = collectedInteraction.values;
		const bounty = await database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company });
		bounty.state = "deleted";
		bounty.save();
		database.models.Completion.destroy({ where: { bountyId: bounty.id } });
		const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, include: database.models.Bounty.Company, order: [["slotNumber", "ASC"]] });
		if (evergreenBounties.length > 0) {
			const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.embed(interaction.guild, bounty.Company.level, false, bounty.Company, [])));
			if (bounty.Company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(bounty.Company.bountyBoardId);
				bountyBoard.threads.fetch(bounty.Company.evergreenThreadId).then(async thread => {
					const message = await thread.fetchStarterMessage();
					message.edit({ embeds });
				});
			}
		} else if (bounty.Company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(bounty.Company.bountyBoardId);
			bountyBoard.threads.fetch(bounty.Company.evergreenThreadId).then(thread => {
				thread.delete(`Evergreen bounty taken down by ${interaction.member}`);
				return database.models.Company.findByPk(bounty.companyId);
			}).then(company => {
				company.evergreenThreadId = null;
				company.save();
			});
		}
		bounty.destroy();

		collectedInteraction.reply({ content: "The evergreen bounty has been taken down.", flags: [MessageFlags.Ephemeral] });
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
};

module.exports = {
	data: {
		name: "take-down",
		description: "Take down one of your bounties without awarding XP (forfeit posting XP)"
	},
	executeSubcommand
};
