const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { SAFE_DELIMITER, SKIP_INTERACTION_HANDLING } = require("../../constants");
const { getRankUpdates } = require("../../util/scoreUtil");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const poster = interaction.options.getUser("poster");
	const openBounties = await database.models.Bounty.findAll({ where: { userId: poster.id, companyId: interaction.guildId, state: "open" } });
	if (openBounties.length < 1) {
		interaction.reply({ content: `${poster} doesn't seem to have any open bounties at the moment.`, ephemeral: true });
		return;
	}

	interaction.reply({
		content: "The poster will also lose the XP they gained for posting the removed bounty.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${SAFE_DELIMITER}${poster.id}`)
					.setPlaceholder("Select a bounty to take down...")
					.setMaxValues(1)
					.setOptions(bountiesToSelectOptions(openBounties))
			)
		],
		ephemeral: true,
		fetchReply: true
	}).then(reply => {
		const collector = reply.createMessageComponentCollector({ max: 1 });
		collector.on("collect", (collectedInteraction) => {
			const posterId = collectedInteraction.customId.split(SAFE_DELIMITER)[1];
			const [bountyId] = collectedInteraction.values;
			database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
				await database.models.Completion.destroy({ where: { bountyId: bounty.id } });
				bounty.state = "deleted";
				bounty.save();
				if (bounty.Company.bountyBoardId) {
					const bountyBoard = await interaction.guild.channels.fetch(bounty.Company.bountyBoardId);
					const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
					postingThread.delete("Bounty taken down by moderator");
				}
				bounty.destroy();

				database.models.Hunter.findOne({ where: { userId: posterId, companyId: interaction.guildId } }).then(async poster => {
					poster.decrement("xp");
					const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
					const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: posterId, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 } });
					if (!participationCreated) {
						participation.decrement("xp");
					}
					getRankUpdates(interaction.guild, database);
				})
				collectedInteraction.reply({ content: `<@${posterId}>'s bounty **${bounty.title}** has been taken down by ${interaction.member}.` });
			});
		})

		collector.on("end", () => {
			interaction.deleteReply();
		})
	})
};

module.exports = {
	data: {
		name: "take-down",
		description: "Take down another user's bounty",
		optionsInput: [
			{
				type: "User",
				name: "poster",
				description: "The mention of the poster of the bounty",
				required: true
			}
		]
	},
	executeSubcommand
};
