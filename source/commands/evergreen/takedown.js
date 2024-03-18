const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getNumberEmoji, trimForSelectOptionDescription, commandMention } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const openBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
	const bountyOptions = openBounties.map(bounty => {
		return {
			emoji: getNumberEmoji(bounty.slotNumber),
			label: bounty.title,
			description: trimForSelectOptionDescription(bounty.description),
			value: bounty.id
		};
	});

	interaction.reply({
		content: `If you'd like to change the title, description, or image of an evergreen bounty, you can use ${commandMention("evergreen edit")} instead.`,
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
			const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, include: database.models.Bounty.Company, order: [["slotNumber", "ASC"]] });
			if (evergreenBounties.length > 0) {
				const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, bounty.Company.level, bounty.Company.festivalMultiplierString(), false, database)));
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

			collectedInteraction.reply({ content: "The evergreen bounty has been taken down.", ephemeral: true });
		})

		collector.on("end", () => {
			interaction.deleteReply();
		})
	});
};

module.exports = {
	data: {
		name: "take-down",
		description: "Take down one of your bounties without awarding XP (forfeit posting XP)"
	},
	executeSubcommand
};
