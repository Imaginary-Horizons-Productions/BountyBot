const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { buildVersionEmbed } = require('../embedHelpers');

const customId = "version";
const options = [
	{ type: "Boolean", name: "get-recent-changes", description: "Otherwise get the full change log", required: true, choices: [] }
];
const subcommands = [];
module.exports = new CommandWrapper(customId, "Get the most recent changes or the full change log", PermissionFlagsBits.ViewChannel, false, true, 3000, options, subcommands,
	/** Send the user the most recent set of patch notes or full change log */
	(interaction) => {
		if (interaction.options.getBoolean(options[0].name)) {
			buildVersionEmbed(interaction.client.user.displayAvatarURL()).then(embed => {
				interaction.reply({ embeds: [embed], ephemeral: true });
			}).catch(console.error);
		} else {
			interaction.reply({
				content: "Here are all the changes so far: ",
				files: [{
					attachment: "./ChangeLog.md",
					name: 'ChangeLog.md'
				}],
				ephemeral: true
			});
		}
	}
);
