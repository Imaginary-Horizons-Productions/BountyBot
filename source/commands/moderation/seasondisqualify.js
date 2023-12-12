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
	const member = interaction.options.getMember("bounty-hunter");
	await database.models.Company.findOrCreate({ where: { id: interaction.guildId } });
	const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
	await database.models.User.findOrCreate({ where: { id: member.id } });
	const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: member.id, companyId: interaction.guildId, seasonId: season.id }, defaults: { isRankDisqualified: true } });
	if (!participationCreated) {
		participation.isRankDisqualified = !participation.isRankDisqualified;
		participation.save();
	}
	if (participationCreated || participation.isRankDisqualified) {
		participation.increment("dqCount");
	}
	getRankUpdates(interaction.guild, database);
	interaction.reply({ content: `<@${member.id}> has been ${participation.isRankDisqualified ? "dis" : "re"}qualified for achieving ranks this season.`, ephemeral: true });
	member.send(`You have been ${participation.isRankDisqualified ? "dis" : "re"}qualified for season ranks this season by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`);
};

module.exports = {
	data: {
		name: "season-disqualify",
		description: "Toggle disqualification from ranking for a bounty hunter in the current season",
		optionsInput: [
			{
				type: "User",
				name: "bounty-hunter",
				description: "The mention of the hunter to disqualify/requalify",
				required: true
			},
			{
				type: "String",
				name: "reason",
				description: "The reason for the disqualification",
				required: true
			}
		]
	},
	executeSubcommand
};
