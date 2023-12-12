const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getRankUpdates } = require("../../util/scoreUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const ranks = await database.models.Rank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "DESC"]] });
	const newThreshold = interaction.options.getNumber("variance-threshold");
	const existingThresholds = ranks.map(rank => rank.varianceThreshold);
	if (existingThresholds.includes(newThreshold)) {
		interaction.reply({ content: `There is already a rank at the ${newThreshold} standard deviations threshold for this server. If you'd like to change the role or rankmoji for that rank, you can use \`/rank edit\`.`, ephemeral: true });
		return;
	}

	if (ranks.length >= MAX_EMBED_FIELD_COUNT) {
		interaction.reply({ content: "A server can only have 25 seasonal ranks at a time.", ephemeral: true });
		return;
	}

	const rawRank = {
		companyId: interaction.guildId,
		varianceThreshold: newThreshold
	};

	const newRole = interaction.options.getRole("role");
	if (newRole) {
		rawRank.roleId = newRole.id;
	}

	const newRankmoji = interaction.options.getString("rankmoji");
	if (newRankmoji) {
		rawRank.rankmoji = newRankmoji;
	}
	database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(() => {
		database.models.Rank.create(rawRank);
	})
	getRankUpdates(interaction.guild, database);
	interaction.reply({ content: `A new seasonal rank ${newRankmoji ? `${newRankmoji} ` : ""}was created at ${newThreshold} standard deviations above mean season xp${newRole ? ` with the role ${newRole}` : ""}.`, ephemeral: true });
};

module.exports = {
	data: {
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
	executeSubcommand
};
