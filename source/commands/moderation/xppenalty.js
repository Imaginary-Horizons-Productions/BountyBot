const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getRankUpdates } = require("../../util/scoreUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	const member = interaction.options.getMember("bounty-hunter");
	const hunter = await logicLayer.hunters.findOneHunter(member.id, interaction.guild.id);
	if (!hunter) {
		interaction.reply({ content: `${member} hasn't interacted with BountyBot yet.`, flags: [MessageFlags.Ephemeral] });
		return;
	}
	const penaltyValue = Math.abs(interaction.options.getInteger("penalty"));
	hunter.decrement({ xp: penaltyValue });
	hunter.increment({ penaltyCount: 1, penaltyPointTotal: penaltyValue });
	const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
	const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: member.id, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 * penaltyValue } });
	if (!participationCreated) {
		participation.decrement("xp", { by: penaltyValue });
	}
	getRankUpdates(interaction.guild, database, logicLayer);
	interaction.reply({ content: `<@${member.id}> has been penalized ${penaltyValue} XP.`, flags: [MessageFlags.Ephemeral] });
	if (!member.bot) {
		member.send(`You have been penalized ${penaltyValue} XP by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`);
	}
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
