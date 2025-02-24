const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	const member = interaction.options.getUser("user");
	await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
	const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(member.id, interaction.guild.id);
	hunter.isBanned = !hunter.isBanned;
	if (hunter.isBanned) {
		hunter.hasBeenBanned = true;
	}
	hunter.save();
	interaction.reply({ content: `${member} has been ${hunter.isBanned ? "" : "un"}banned from interacting with BountyBot.`, flags: [MessageFlags.Ephemeral] });
	if (!member.bot) {
		member.send(`You have been ${hunter.isBanned ? "" : "un"}banned from interacting with BountyBot on ${interaction.guild.name}. The reason provided was: ${interaction.options.getString("reason")}`);
	}
};

module.exports = {
	data: {
		name: "bountybot-ban",
		description: "Toggle whether the provided user can interact with bounties or toasts",
		optionsInput: [
			{
				type: "User",
				name: "user",
				description: "The user to ban or unban",
				required: true
			},
			{
				type: "String",
				name: "reason",
				description: "The reason for the ban or unban",
				required: true
			}
		]
	},
	executeSubcommand
};
