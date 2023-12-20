const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const member = interaction.options.getUser("user");
	await database.models.User.findOrCreate({ where: { id: member.id } });
	await database.models.Company.findOrCreate({ where: { id: interaction.guildId } });
	const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: member.id, companyId: interaction.guildId } });
	hunter.isBanned = !hunter.isBanned;
	if (hunter.isBanned) {
		hunter.hasBeenBanned = true;
	}
	hunter.save();
	interaction.reply({ content: `${member} has been ${hunter.isBanned ? "" : "un"}banned from interacting with BountyBot.`, ephemeral: true });
	member.send(`You have been ${hunter.isBanned ? "" : "un"}banned from interacting with BountyBot on ${interaction.guild.name}. The reason provided was: ${interaction.options.getString("reason")}`).catch(error => {
		if (error.code !== 50007) { // Error: Bots can't send messages to bots
			console.error(error);
		}
	});
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
