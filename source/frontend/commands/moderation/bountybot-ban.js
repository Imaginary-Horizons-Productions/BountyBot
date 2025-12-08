const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { butIgnoreCantSendToThisUserErrors } = require("../../shared");

module.exports = new SubcommandWrapper("bountybot-ban", "Toggle whether the provided user can interact with bounties or toasts",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const discordUser = interaction.options.getUser("user");
		await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		let hunter;
		if (discordUser.id === origin.hunter.userId) {
			hunter = origin.hunter;
		} else {
			hunter = (await logicLayer.hunters.findOrCreateBountyHunter(discordUser.id, interaction.guild.id)).hunter[0];
		}
		hunter.isBanned = !hunter.isBanned;
		if (hunter.isBanned) {
			hunter.hasBeenBanned = true;
		}
		hunter.save();
		interaction.reply({ content: `${discordUser} has been ${hunter.isBanned ? "" : "un"}banned from interacting with BountyBot on this server.`, flags: MessageFlags.Ephemeral });
		if (!discordUser.bot) {
			discordUser.send(`You have been ${hunter.isBanned ? "" : "un"}banned from interacting with BountyBot on ${interaction.guild.name}. The reason provided was: ${interaction.options.getString("reason")}`)
				.catch(butIgnoreCantSendToThisUserErrors);
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
