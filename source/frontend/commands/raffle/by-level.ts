import { MessageFlags, SlashCommandIntegerOption } from "discord.js";
import { SubcommandFunctionality } from "../../classes/index.ts";
import { raffleResultEmbed } from "../../shared/index.ts";

const levelOption = new SlashCommandIntegerOption().setName("level")
	.setDescription("The level a hunter needs to be eligible for this raffle")
	.setRequired(true);

export default new SubcommandFunctionality("by-level", "Select a user at or above a particular level",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const levelThreshold = interaction.options.getInteger(levelOption.name, true);
		const eligibleHunters = await logicLayer.hunters.findHuntersAtOrAboveLevel(theater.company, levelThreshold);
		const eligibleMembers = (await interaction.guild.members.fetch({ user: eligibleHunters.map(hunter => hunter.userId) })).filter(member => member.manageable);
		if (eligibleMembers.size < 1) {
			interaction.reply({ content: `There wouldn't be any eligible bounty hunters for this raffle (at or above level ${levelThreshold}).`, flags: MessageFlags.Ephemeral });
			return;
		}
		const winner = eligibleMembers.at(Math.floor(Math.random() * eligibleMembers.size));
		interaction.reply({ embeds: [raffleResultEmbed(eligibleHunters.find(hunter => hunter.userId === winner.id).profileColor, interaction.guild, theater.company.raffleThumbnailURL, winner, `Level ${levelThreshold} or higher (${eligibleMembers.size} eligible entrant${eligibleMembers.size === 1 ? "" : "s"})`)] });
		theater.company.update("nextRaffleString", null);
	}
).setOptions(levelOption);
