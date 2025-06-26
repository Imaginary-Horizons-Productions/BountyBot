const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { raffleResultEmbed } = require("../../shared");

module.exports = new SubcommandWrapper("by-level", "Select a user at or above a particular level",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const levelThreshold = interaction.options.getInteger("level");
		const eligibleHunters = await logicLayer.hunters.findHuntersAtOrAboveLevel(origin.company, levelThreshold);
		const eligibleMembers = (await interaction.guild.members.fetch({ user: eligibleHunters.map(hunter => hunter.userId) })).filter(member => member.manageable);
		if (eligibleMembers.size < 1) {
			interaction.reply({ content: `There wouldn't be any eligible bounty hunters for this raffle (at or above level ${levelThreshold}).`, flags: MessageFlags.Ephemeral });
			return;
		}
		const winner = eligibleMembers.at(Math.floor(Math.random() * eligibleMembers.size));
		interaction.reply({ embeds: [raffleResultEmbed(eligibleHunters.find(hunter => hunter.userId === winner.id).profileColor, interaction.guild, winner, `Level ${levelThreshold} or higher (${eligibleMembers.size} eligible entrant${eligibleMembers.size === 1 ? "" : "s"})`)] });
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
