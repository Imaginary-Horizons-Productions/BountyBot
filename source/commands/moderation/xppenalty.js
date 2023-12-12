const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const member = interaction.options.getMember("bounty-hunter");
	const hunter = await database.models.Hunter.findOne({ where: { userId: member.id, companyId: interaction.guildId } });
	if (!hunter) {
		interaction.reply({ content: `${member} hasn't interacted with BountyBot yet.`, ephemeral: true });
		return;
	}
	const penaltyValue = Math.abs(interaction.options.getInteger("penalty"));
	hunter.decrement({ xp: penaltyValue });
	hunter.increment({ penaltyCount: 1, penaltyPointTotal: penaltyValue });
	const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
	const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: member.id, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 * penaltyValue } });
	if (!participationCreated) {
		participation.decrement("xp", { by: penaltyValue });
	}
	getRankUpdates(interaction.guild, database);
	interaction.reply({ content: `<@${member.id}> has been penalized ${penaltyValue} XP.`, ephemeral: true });
	member.send(`You have been penalized ${penaltyValue} XP by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`);
};

module.exports = {
	data: {
		name: "xp-penalty",
		description: "Reduce a bounty hunter's XP",
		optionsInput: [
			{
				type: "User",
				name: "bounty-hunter",
				description: "The bounty hunter to remove XP from",
				required: true
			},
			{
				type: "Integer",
				name: "penalty",
				description: "The amount of XP to remove",
				required: true
			},
			{
				type: "String",
				name: "reason",
				description: "The reason for the penalty",
				required: true
			}
		]
	},
	executeSubcommand
};
