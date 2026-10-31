import { MessageFlags, SlashCommandUserOption } from "discord.js";
import { SubcommandFunctionality } from "../../classes/index.ts";
import { butIgnoreCantDirectMessageThisUserErrors } from "../../shared/index.ts";

const revokeeOption = new SlashCommandUserOption().setName("revokee")
	.setDescription("The bounty hunter for whom to revoke item find bonus")
	.setRequired(true);

export default new SubcommandFunctionality("revoke-goal-bonus", "Revoke Goal contribution item find bonus",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const revokeeUser = interaction.options.getUser(revokeeOption.name, true);
		const hunter = revokeeUser.id === theater.hunter.userId ? theater.hunter : await logicLayer.hunters.findOneHunter(revokeeUser.id, interaction.guild.id);
		if (!hunter) {
			interaction.reply({ content: `${revokeeUser.toString()} hasn't interacted with BountyBot yet.`, flags: MessageFlags.Ephemeral });
			return;
		}
		if (hunter.itemFindBoost) {
			hunter.update({ "itemFindBoost": false });
			interaction.reply({ content: `${revokeeUser.toString()}'s Goal Contribution item find boost has been revoked.`, flags: MessageFlags.Ephemeral });
			revokeeUser.send({ content: `Your Item Find Bonus in ${interaction.guild} was revoked by ${interaction.user}.` })
				.catch(butIgnoreCantDirectMessageThisUserErrors);
		} else {
			interaction.reply({ content: `${revokeeUser.toString()} doesn't have Goal Contribution item find boost.`, flags: MessageFlags.Ephemeral });
		}
	}
).setOptions(revokeeOption);
