const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');

const customId = "rank";
const options = [];
const subcommands = [
	{
		name: "add",
		description: "Add a seasonal rank for showing outstanding bounty hunters",
		optionsInput: [
			{
				type: "Number",
				name: "variance-threshold",
				description: "The number of standard deviations above mean of season XP earned to qualify",
				required: true
			},
			{
				type: "Role",
				name: "role",
				description: "The role to give hunters that attain this rank",
				required: false
			},
			{
				type: "String",
				name: "rankmoji",
				description: "An emoji associated with this rank",
				required: false
			}
		]
	}
];
module.exports = new CommandWrapper(customId, "Seasonal Ranks distinguish bounty hunters who have above average season XP", PermissionFlagsBits.ManageRoles, false, false, 3000, options, subcommands,
	(interaction) => {
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // add
				database.models.GuildRank.findAll({ where: { guildId: interaction.guildId } }).then(guildRanks => {
					const newThreshold = interaction.options.getNumber(subcommands[0].optionsInput[0].name);
					const existingThresholds = guildRanks.map(rank => rank.varianceThreshold);
					if (existingThresholds.includes(newThreshold)) {
						interaction.reply({ content: `There is already a rank at the ${newThreshold} standard deviations threshold for this server. If you'd like to change the role or rankmoji for that rank, you can use \`/rank edit\`.`, ephemeral: true });
						return;
					}

					const rawRank = {
						guildId: interaction.guildId,
						varianceThreshold: newThreshold
					};

					const newRole = interaction.options.getRole(subcommands[0].optionsInput[1].name);
					if (newRole) {
						rawRank.roleId = newRole.id;
					}

					const newRankmoji = interaction.options.getString(subcommands[0].optionsInput[2].name);
					if (newRankmoji) {
						rawRank.rankmoji = newRankmoji;
					}
					database.models.Guild.findOrCreate({ where: { id: interaction.guildId } }).then(() => {
						database.models.GuildRank.create(rawRank);
					})
					getRankUpdates(interaction.guild);
					interaction.reply({ content: `A new seasonal rank ${newRankmoji ? `${newRankmoji} ` : ""}was created at ${newThreshold} standard deviations above mean season xp${newRole ? ` with the role ${newRole}` : ""}.`, ephemeral: true });
				})
				break;
		}
	}
);
