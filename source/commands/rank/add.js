const { MessageFlags } = require("discord.js");
const { getRankUpdates } = require("../../util/scoreUtil");
const { MAX_EMBED_FIELD_COUNT } = require("../../constants");
const { commandMention } = require("../../util/textUtil");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("add", "Add a seasonal rank for showing outstanding bounty hunters",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const newThreshold = interaction.options.getNumber("variance-threshold");
		const existingThresholds = ranks.map(rank => rank.varianceThreshold);
		if (existingThresholds.includes(newThreshold)) {
			interaction.reply({ content: `There is already a rank at the ${newThreshold} standard deviations threshold for this server. If you'd like to change the role or rankmoji for that rank, you can use ${commandMention("rank edit")}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		if (ranks.length >= MAX_EMBED_FIELD_COUNT) {
			interaction.reply({ content: "A server can only have 25 seasonal ranks at a time.", flags: [MessageFlags.Ephemeral] });
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
		logicLayer.companies.findOrCreateCompany(interaction.guild.id).then(() => {
			logicLayer.ranks.createCustomRank(rawRank);
		})
		getRankUpdates(interaction.guild, logicLayer);
		interaction.reply({ content: `A new seasonal rank ${newRankmoji ? `${newRankmoji} ` : ""}was created at ${newThreshold} standard deviations above mean season xp${newRole ? ` with the role ${newRole}` : ""}.`, flags: [MessageFlags.Ephemeral] });
	}
).setOptions(
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
);
