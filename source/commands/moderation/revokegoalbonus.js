const { CommandInteraction, MessageFlags, userMention } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const user = interaction.options.get("revokee", true);
	const hunter = await database.models.Hunter.findOne({ where: { userId: user.id, companyId: interaction.guildId } });
	if (!hunter) {
		interaction.reply({ content: `${user} hasn't interacted with BountyBot yet.`, flags: [MessageFlags.Ephemeral] });
		return;
	}
	hunter.update("itemFindBoost", false);
	interaction.reply({ content: `${user}'s Goal Contribution item find boost has been revoked.`, flags: [MessageFlags.Ephemeral] });
};

module.exports = {
	data: {
		name: "revoke-goal-bonus",
		description: "Revoke Goal contribution item find bonus",
		optionsInput: [
			{
				type: "User",
				name: "revokee",
				description: "The bounty hunter for whom to revoke item find bonus",
				required: true
			}
		]
	},
	executeSubcommand
};
