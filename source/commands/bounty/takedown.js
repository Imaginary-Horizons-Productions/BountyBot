const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { trimForSelectOptionDescription, getNumberEmoji } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING, commandIds } = require("../../constants");
const { getRankUpdates } = require("../../util/scoreUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: posterId, state: "open" } }).then(openBounties => {
		const bountyOptions = openBounties.map(bounty => {
			return {
				emoji: getNumberEmoji(bounty.slotNumber),
				label: bounty.title,
				description: trimForSelectOptionDescription(bounty.description),
				value: bounty.id
			};
		});

		interaction.reply({
			content: `If you'd like to change the title, description, image, or time of your bounty, you can use </bounty edit:${commandIds.bounty}> instead.`,
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a bounty to take down...")
						.setMaxValues(1)
						.setOptions(bountyOptions)
				)
			],
			ephemeral: true,
			fetchReply: true
		}).then(reply => {
			const collector = reply.createMessageComponentCollector({ max: 1 });
			collector.on("collect", async (collectedInteraction) => {
				const [bountyId] = collectedInteraction.values;
				const bounty = await database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company });
				bounty.state = "deleted";
				bounty.save();
				database.models.Completion.destroy({ where: { bountyId: bounty.id } });
				if (bounty.Company.bountyBoardId) {
					const bountyBoard = await interaction.guild.channels.fetch(bounty.Company.bountyBoardId);
					const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
					postingThread.delete("Bounty taken down by poster");
				}
				bounty.destroy();

				database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } }).then(async hunter => {
					hunter.decrement("xp");
					const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
					const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: interaction.user.id, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 } });
					if (!participationCreated) {
						participation.decrement("xp");
					}
					getRankUpdates(interaction.guild, database);
				})

				collectedInteraction.reply({ content: "Your bounty has been taken down.", ephemeral: true });
			})

			collector.on("end", () => {
				interaction.deleteReply();
			})
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
