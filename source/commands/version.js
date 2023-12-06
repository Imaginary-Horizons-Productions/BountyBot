const { CommandWrapper } = require('../classes');
const { buildVersionEmbed } = require('../util/embedUtil');

const mainId = "version";
const options = [
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
];
const subcommands = [];
module.exports = new CommandWrapper(mainId, "Get the most recent changes or the full change log", null, false, true, 3000, options, subcommands,
	/** Send the user the most recent set of patch notes or full change log */
	(interaction, database, runMode) => {
		if (interaction.options.getString(options[0].name) === "last-version") {
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
