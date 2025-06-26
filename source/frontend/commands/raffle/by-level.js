const { MessageFlags, Colors, EmbedBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

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
		const embed = new EmbedBuilder().setColor(Colors[eligibleHunters.find(hunter => hunter.userId === winner.id).profileColor])
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
			.setTitle("Raffle Results")
			//TODONOW customizable thumbnail
			.setThumbnail("https://cdn.discordapp.com/attachments/545684759276421120/1387920759870984283/ticket.png?ex=685f196f&is=685dc7ef&hm=a8e49b311c5c8854b0fc68ef9d2cf00aead714a0d21438b1b9fa2089f8e7a3de&")
			.setDescription(`The winner of this raffle is: ${winner}`)
			.addFields({ name: "Qualifications", value: `Level ${levelThreshold} or higher (${eligibleMembers.size} eligible entrant${eligibleMembers.size === 1 ? "" : "s"})` })
			.setTimestamp();

		if (interaction.guild.bannerURL()) {
			embed.setImage(interaction.guild.bannerURL());
		}
		interaction.reply({ embeds: [embed] });
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
