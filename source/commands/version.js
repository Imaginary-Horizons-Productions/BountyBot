const { AttachmentBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { buildVersionEmbed } = require('../util/embedUtil');

const mainId = "version";
module.exports = new CommandWrapper(mainId, "Get the most recent changes or the full change log", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** Send the user the most recent set of patch notes or full change log */
	(interaction, runMode) => {
		if (interaction.options.getString("notes-length") === "last-version") {
			buildVersionEmbed(interaction.client.user.displayAvatarURL()).then(embed => {
				interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
			}).catch(console.error);
		} else {
			interaction.reply({
				content: "Here are all the changes so far: ",
				files: [new AttachmentBuilder("./ChangeLog.md")],
				flags: [MessageFlags.Ephemeral]
			});
		}
	}
).setOptions(
	{
		type: "String",
		name: "notes-length",
		description: "Get the changes in last version or the full change log",
		choices: [
			{ name: "Last version", value: "last-version" },
			{ name: "Full change log", value: "full-change-log" }
		],
		required: true
	}
);
