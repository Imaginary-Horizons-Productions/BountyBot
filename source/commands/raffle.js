const { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { Op } = require('sequelize');

const mainId = "raffle";
const options = [];
const subcommands = [
	{
		name: "by-rank",
		description: "Select a user at or above a particular rank"
	},
	{
		name: "by-level",
		description: "Select a user at or above a particular level",
		optionsInput: [
			{
				type: "Integer",
				name: "level",
				description: "The level a hunter needs to be eligible for this raffle",
				required: true
			}
		]
	},
	{
		name: "announce-upcoming",
		description: "Announce an upcoming raffle",
		optionsInput: [
			{
				type: "String",
				name: "announcement",
				description: "A timestamp and/or eligibilty requirements can encourage interaction",
				required: true
			}
		]
	}
];
module.exports = new CommandWrapper(mainId, "Randomly select a bounty hunter from a variety of pools", PermissionFlagsBits.ManageGuild, false, true, 3000, options, subcommands,
	(interaction, database, runMode) => {
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // by-rank
				database.models.Rank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "ASC"]] }).then(async ranks => {
					if (ranks.length < 1) {
						interaction.reply({ content: "This server doesn't have any ranks configured.", ephemeral: true });
						return;
					}
					const guildRoles = await interaction.guild.roles.fetch();
					interaction.reply({
						content: "Select a rank to be the eligibility threshold for this raffle:",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("rafflerank")
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
						ephemeral: true
					}).catch(error => {
						if (Object.values(error.rawError.errors.data.components).some(row => Object.values(row.components).some(component => Object.values(component.options).some(option => option.emoji.name._errors.some(error => error.code == "BUTTON_COMPONENT_INVALID_EMOJI"))))) {
							interaction.reply({ content: "A raffle by ranks could not be started because this server has a rank with a non-emoji as a rankmoji.", ephemeral: true });
						} else {
							console.error(error);
						}
					});
				});
				break;
			case subcommands[1].name: // by-level
				const levelThreshold = interaction.options.getInteger("level");
				database.models.Hunter.findAll({ where: { companyId: interaction.guildId, level: { [Op.gte]: levelThreshold } } }).then(eligibleHunters => {
					return interaction.guild.members.fetch({ user: eligibleHunters.map(hunter => hunter.userId) });
				}).then((eligibleMembers) => {
					const eligibleIds = eligibleMembers.filter(member => member.manageable).map(member => member.id);
					if (eligibleIds.size < 1) {
						interaction.reply({ content: `There wouldn't be any eligible bounty hunters for this raffle (at or above level ${levelThreshold}).`, ephemeral: true });
						return;
					}
					const winnerId = eligibleIds.at(Math.floor(Math.random() * eligibleIds.size));
					interaction.reply(`The winner of this raffle is: <@${winnerId}>`);
					database.models.Company.findByPk(interaction.guildId).then(company => {
						company.update("nextRaffleString", null);
					});
				});
				break;
			case subcommands[2].name: // announce-upcoming
				database.models.Company.findByPk(interaction.guildId).then(company => {
					const announcement = interaction.options.getString("announcement")
					company.update("nextRaffleString", announcement);
					interaction.reply(company.sendAnnouncement({ content: announcement }));
				})
				break;
		}
	}
);
