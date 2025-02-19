const { CommandInteraction, MessageFlags, userMention } = require("discord.js");
const { Sequelize } = require("sequelize");
const { findOneHunter } = require("../../logic/hunters");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const revokeOption = interaction.options.get("revokee", true);
	const hunter = await findOneHunter(revokeOption.value, interaction.guild.id);
	if (!hunter) {
		interaction.reply({ content: `${userMention(revokeOption.value)} hasn't interacted with BountyBot yet.`, flags: [MessageFlags.Ephemeral] });
		return;
	}
	if (hunter.itemFindBoost) {
		hunter.update({ "itemFindBoost": false });
		interaction.reply({ content: `${userMention(revokeOption.value)}'s Goal Contribution item find boost has been revoked.`, flags: [MessageFlags.Ephemeral] });
		revokeOption.user.send({ content: `Your Item Find Bonus in ${interaction.guild} was revoked by ${interaction.user}.` });
	} else {
		interaction.reply({ content: `${userMention(revokeOption.value)} doesn't have Goal Contribution item find boost.`, flags: [MessageFlags.Ephemeral] });
	}
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
