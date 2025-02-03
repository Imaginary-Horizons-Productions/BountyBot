const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { Sequelize, Op } = require("sequelize");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const ranks = await database.models.Rank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "ASC"]] });
	if (ranks.length < 1) {
		interaction.reply({ content: "This server doesn't have any ranks configured.", flags: [MessageFlags.Ephemeral] });
		return;
	}
	const guildRoles = await interaction.guild.roles.fetch();
	interaction.reply({
		content: "Select a rank to be the eligibility threshold for this raffle:",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setPlaceholder("Select a rank...")
					.addOptions(ranks.map((rank, index) => {
						const option = {
							label: rank.roleId ? guildRoles.get(rank.roleId).name : `Rank ${index + 1}`,
							description: `Variance Threshold: ${rank.varianceThreshold}`,
							value: index.toString()
						};
						if (rank.rankmoji) {
							option.emoji = rank.rankmoji;
						}
						return option;
					}))
			)
		],
		flags: [MessageFlags.Ephemeral],
		withResponse: true
	}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(collectedInteraction => {
		const rankIndex = Number(collectedInteraction.values[0]);
		database.models.Hunter.findAll({ where: { companyId: interaction.guildId, rank: { [Op.gte]: rankIndex } } }).then(unvalidatedHunters => {
			const qualifiedHunters = unvalidatedHunters.filter(hunter => !hunter.isRankDisqualified);
			return interaction.guild.members.fetch({ user: qualifiedHunters.map(hunter => hunter.userId) });
		}).then((unvalidatedMembers) => {
			const eligibleMembers = unvalidatedMembers.filter(member => member.manageable);
			if (eligibleMembers.size < 1) {
				database.models.Rank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "ASC"]] }).then(ranks => {
					const rank = ranks[rankIndex];
					collectedInteraction.reply({ content: `There wouldn't be any eligible bounty hunters for this raffle (at or above the rank ${rank.roleId ? `<@&${rank.roleId}>` : `Rank ${rankIndex + 1}`}).`, flags: [MessageFlags.Ephemeral] });
				});
				return;
			}
			const winner = eligibleMembers.at(Math.floor(Math.random() * eligibleMembers.size));
			collectedInteraction.reply(`The winner of this raffle is: ${winner}`);
			database.models.Company.findByPk(interaction.guildId).then(company => {
				company.update("nextRaffleString", null);
			});
		})
	}).catch(error => {
		if (Object.values(error.rawError.errors.data.components).some(row => Object.values(row.components).some(component => Object.values(component.options).some(option => option.emoji.name._errors.some(error => error.code == "BUTTON_COMPONENT_INVALID_EMOJI"))))) {
			interaction.reply({ content: "A raffle by ranks could not be started because this server has a rank with a non-emoji as a rankmoji.", flags: [MessageFlags.Ephemeral] });
		} else if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
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
		name: "by-rank",
		description: "Select a user at or above a particular rank"
	},
	executeSubcommand
};
