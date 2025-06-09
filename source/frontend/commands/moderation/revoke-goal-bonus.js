const { MessageFlags, userMention } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("revoke-goal-bonus", "Revoke Goal contribution item find bonus",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const revokeOption = interaction.options.get("revokee", true);
		const hunter = revokeOption.value === origin.hunter.userId ? origin.hunter : await logicLayer.hunters.findOneHunter(revokeOption.value, interaction.guild.id);
		if (!hunter) {
			interaction.reply({ content: `${userMention(revokeOption.value)} hasn't interacted with BountyBot yet.`, flags: MessageFlags.Ephemeral });
			return;
		}
		if (hunter.itemFindBoost) {
			hunter.update({ "itemFindBoost": false });
			interaction.reply({ content: `${userMention(revokeOption.value)}'s Goal Contribution item find boost has been revoked.`, flags: MessageFlags.Ephemeral });
			revokeOption.user.send({ content: `Your Item Find Bonus in ${interaction.guild} was revoked by ${interaction.user}.` });
		} else {
			interaction.reply({ content: `${userMention(revokeOption.value)} doesn't have Goal Contribution item find boost.`, flags: MessageFlags.Ephemeral });
		}
	}
).setOptions(
	{
		type: "User",
		name: "revokee",
		description: "The bounty hunter for whom to revoke item find bonus",
		required: true
	}
);
