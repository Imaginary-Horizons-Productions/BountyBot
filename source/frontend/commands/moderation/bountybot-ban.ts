import { MessageFlags, SlashCommandStringOption, SlashCommandUserOption } from "discord.js";
import { SubcommandFunctionality } from "../../classes/index.ts";
import { butIgnoreCantDirectMessageThisUserErrors } from "../../shared/index.ts";

const userOption = new SlashCommandUserOption().setName("user")
	.setDescription("The user to ban or unban")
	.setRequired(true);

const reasonOption = new SlashCommandStringOption().setName("reason")
	.setDescription("The reason for the ban or unban")
	.setRequired(true);

export default new SubcommandFunctionality("bountybot-ban", "Toggle whether the provided user can interact with bounties or toasts",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const discordUser = interaction.options.getUser(userOption.name, true);
		await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		let hunter;
		if (discordUser.id === theater.hunter.userId) {
			hunter = theater.hunter;
		} else {
			hunter = (await logicLayer.hunters.findOrCreateBountyHunter(discordUser.id, interaction.guild.id)).hunter[0];
		}
		hunter.update({
			isBanned: !hunter.isBanned,
			hasBeenBanned: true
		});
		interaction.reply({ content: `${discordUser} has been ${hunter.isBanned ? "" : "un"}banned from interacting with BountyBot on this server.`, flags: MessageFlags.Ephemeral });
		if (!discordUser.bot) {
			discordUser.send(`You have been ${hunter.isBanned ? "" : "un"}banned from interacting with BountyBot on ${interaction.guild.name}. The reason provided was: ${interaction.options.getString(reasonOption.name, true)}`)
				.catch(butIgnoreCantDirectMessageThisUserErrors);
		}
	}
).setOptions(
	userOption,
	reasonOption
);
