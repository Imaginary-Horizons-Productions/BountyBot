const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("bountybot-ban", "Toggle whether the provided user can interact with bounties or toasts",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const discordUser = interaction.options.getUser("user");
		await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(discordUser.id, interaction.guild.id);
		hunter.isBanned = !hunter.isBanned;
		if (hunter.isBanned) {
			hunter.hasBeenBanned = true;
		}
		hunter.save();
		interaction.reply({ content: `${discordUser} has been ${hunter.isBanned ? "" : "un"}banned from interacting with BountyBot.`, flags: [MessageFlags.Ephemeral] });
		if (!discordUser.bot) {
			discordUser.send(`You have been ${hunter.isBanned ? "" : "un"}banned from interacting with BountyBot on ${interaction.guild.name}. The reason provided was: ${interaction.options.getString("reason")}`);
		}
	}
).setOptions(
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
);
