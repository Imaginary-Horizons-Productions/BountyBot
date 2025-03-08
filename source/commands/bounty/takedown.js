const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { Sequelize } = require("sequelize");
const { commandMention } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { getRankUpdates } = require("../../util/scoreUtil");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic"), string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer, posterId]) {
	logicLayer.bounties.findOpenBounties(posterId, interaction.guild.id).then(openBounties => {
		interaction.reply({
			content: `If you'd like to change the title, description, image, or time of your bounty, you can use ${commandMention("bounty edit")} instead.`,
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
			const bounty = await database.models.Bounty.findByPk(bountyId);
			bounty.state = "deleted";
			bounty.save();
			database.models.Completion.destroy({ where: { bountyId: bounty.id } });
			const [company] = await logicLayer.companies.findOrCreateCompany(collectedInteraction.guildId);
			if (company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(company.bountyBoardId);
				const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
				postingThread.delete("Bounty taken down by poster");
			}
			bounty.destroy();

			logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id).then(async hunter => {
				hunter.decrement("xp");
				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
				logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, -1);
				getRankUpdates(interaction.guild, logicLayer);
			})

			collectedInteraction.reply({ content: "Your bounty has been taken down.", flags: [MessageFlags.Ephemeral] });
		}).catch(error => {
			if (error.codes !== DiscordjsErrorCodes.InteractionCollectorError) {
				console.error(error);
			}
		}).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		})
	})
};

module.exports = {
	data: {
		name: "take-down",
		description: "Take down one of your bounties without awarding XP (forfeit posting XP)"
	},
	executeSubcommand
};
