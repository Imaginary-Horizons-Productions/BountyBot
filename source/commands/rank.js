const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { getRankUpdates } = require('../util/scoreUtil');

const mainId = "rank";
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
	},
	{
		name: "info",
		description: "Get the information about an existing seasonal rank",
		optionsInput: [
			{
				type: "Number",
				name: "variance-threshold",
				description: "The variance threshold of the rank to view",
				required: true
			}
		]
	},
	{
		name: "edit",
		description: "Change the role or rankmoji for a seasonal rank",
		optionsInput: [
			{
				type: "Number",
				name: "variance-threshold",
				description: "The variance threshold of the rank to edit",
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
	},
	{
		name: "remove",
		description: "Remove an existing seasonal rank",
		optionsInput: [
			{
				type: "Number",
				name: "variance-threshold",
				description: "The variance threshold of the rank to review",
				required: true
			}
		]
	}
];
module.exports = new CommandWrapper(mainId, "Seasonal Ranks distinguish bounty hunters who have above average season XP", PermissionFlagsBits.ManageRoles, true, false, 3000, options, subcommands,
	(interaction) => {
		let varianceThreshold;
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // add
				database.models.CompanyRank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "DESC"]] }).then(companyRanks => {
					const newThreshold = interaction.options.getNumber(subcommands[0].optionsInput[0].name);
					const existingThresholds = companyRanks.map(rank => rank.varianceThreshold);
					if (existingThresholds.includes(newThreshold)) {
						interaction.reply({ content: `There is already a rank at the ${newThreshold} standard deviations threshold for this server. If you'd like to change the role or rankmoji for that rank, you can use \`/rank edit\`.`, ephemeral: true });
						return;
					}

					if (companyRanks.length > 24) {
						interaction.reply({ content: "A server can only have 25 seasonal ranks at a time.", ephemeral: true });
						return;
					}

					const rawRank = {
						companyId: interaction.guildId,
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
					database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(() => {
						database.models.CompanyRank.create(rawRank);
					})
					getRankUpdates(interaction.guild);
					interaction.reply({ content: `A new seasonal rank ${newRankmoji ? `${newRankmoji} ` : ""}was created at ${newThreshold} standard deviations above mean season xp${newRole ? ` with the role ${newRole}` : ""}.`, ephemeral: true });
				})
				break;
			case subcommands[1].name: // info
				varianceThreshold = interaction.options.getNumber(subcommands[1].optionsInput[0].name);
				database.models.CompanyRank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "DESC"]] }).then(companyRanks => {
					let index = 0;
					const rank = companyRanks.find(rank => {
						index++;
						return rank.varianceThreshold == varianceThreshold
					});

					if (!rank) {
						interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${varianceThreshold}.`, ephemeral: true });
						return;
					}

					let content = `${rank.rankmoji ?? ""}${rank.roleId ? `<@&${rank.roleId}>` : `Rank ${index}`}\nVariance Threshold: ${rank.varianceThreshold}`;
					interaction.reply({ content, ephemeral: true });
				});
				break;
			case subcommands[2].name: // edit
				varianceThreshold = interaction.options.getNumber(subcommands[2].optionsInput[0].name);
				database.models.CompanyRank.findOne({ where: { companyId: interaction.guildId, varianceThreshold } }).then(rank => {
					if (!rank) {
						interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${varianceThreshold}.`, ephemeral: true });
						return;
					}

					const updateOptions = {};

					const newRole = interaction.options.getRole(subcommands[0].optionsInput[1].name);
					if (newRole) {
						updateOptions.roleId = newRole.id;
					}

					const newRankmoji = interaction.options.getString(subcommands[0].optionsInput[2].name);
					if (newRankmoji) {
						updateOptions.rankmoji = newRankmoji;
					}
					rank.update(updateOptions);
					getRankUpdates(interaction.guild);
					interaction.reply({ content: `The seasonal rank ${newRankmoji ? `${newRankmoji} ` : ""}at ${varianceThreshold} standard deviations above mean season xp was updated${newRole ? ` to give the role ${newRole}` : ""}.`, ephemeral: true });
				})
				break;
			case subcommands[3].name: // remove
				varianceThreshold = interaction.options.getNumber(subcommands[3].optionsInput[0].name);
				database.models.CompanyRank.findOne({ where: { companyId: interaction.guildId, varianceThreshold } }).then(rank => {
					if (!rank) {
						interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${varianceThreshold}.`, ephemeral: true });
						return;
					}

					rank.destroy();
					interaction.reply({ content: "The rank has been removed.", ephemeral: true });
				});
				break;
		}
	}
);
