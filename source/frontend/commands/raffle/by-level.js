const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("by-level", "Select a user at or above a particular level",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const levelThreshold = interaction.options.getInteger("level");
		const eligibleHunters = await logicLayer.hunters.findHuntersAtOrAboveLevel(interaction.guild.id, levelThreshold);
		const eligibleMembers = await interaction.guild.members.fetch({ user: eligibleHunters.map(hunter => hunter.userId) });
		const eligibleIds = eligibleMembers.filter(member => member.manageable).map(member => member.id);
		if (eligibleIds.size < 1) {
			interaction.reply({ content: `There wouldn't be any eligible bounty hunters for this raffle (at or above level ${levelThreshold}).`, flags: MessageFlags.Ephemeral });
			return;
		}
		const winnerId = eligibleIds.at(Math.floor(Math.random() * eligibleIds.size));
		interaction.reply(`The winner of this raffle is: <@${winnerId}>`);
		origin.company.update("nextRaffleString", null);
	}
).setOptions(
	{
		type: "Integer",
		name: "level",
		description: "The level a hunter needs to be eligible for this raffle",
		required: true
	}
);
