const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getRankUpdates } = require("../../util/scoreUtil");
const { findOrCreateCompany } = require("../../logic/companies");
const { findOrCreateCurrentSeason } = require("../../logic/seasons");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const member = interaction.options.getMember("bounty-hunter");
	await findOrCreateCompany(interaction.guild.id);
	const [season] = await findOrCreateCurrentSeason(interaction.guildId);
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
	interaction.reply({ content: `<@${member.id}> has been ${participation.isRankDisqualified ? "dis" : "re"}qualified for achieving ranks this season.`, flags: [MessageFlags.Ephemeral] });
	if (!member.bot) {
		member.send(`You have been ${participation.isRankDisqualified ? "dis" : "re"}qualified for season ranks this season by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`);
	}
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
