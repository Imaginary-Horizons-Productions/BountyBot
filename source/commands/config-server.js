const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');

const mainId = "config-server";
const options = [
	{
		type: "String",
		name: "notification",
		description: "Configure who to send notifications to (default @here)",
		required: false,
		choices: [
			{ name: "Notify online members (@here)", value: "@here" },
			{ name: "Notify all members (@everyone)", value: "@everyone" },
			{ name: "No prefix", value: "(nothing)" },
			{ name: "Suppress notifications (@silent)", value: "@silent" }
		]
	},
	{
		type: "Boolean",
		name: "server-boost-xp",
		description: "Configure whether boosting the server awards XP (default true)",
		required: false
	}
];
const subcommands = [];
module.exports = new CommandWrapper(mainId, "Configure BountyBot settings for this server", PermissionFlagsBits.ManageGuild, false, false, 3000, options, subcommands,
	(interaction) => {
		database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(([company]) => {
			const updatePayload = {};
			let content = "The following server settings have been configured:";

			const prefix = interaction.options.getString(options[0].name);
			if (prefix !== null) {
				updatePayload.announcementPrefix = prefix === "(nothing)" ? "" : prefix;
				content += `\n- The announcment prefix was set to ${prefix}`;
			}

			const shouldBoostXP = interaction.options.getBoolean(options[1].name);
			if (shouldBoostXP !== null) {
				updatePayload.disableBoostXP = !shouldBoostXP;
				content += `\n- XP for Server Boosts has been ${shouldBoostXP ? "en" : "dis"}abled`;
			}

			company.update(updatePayload);
			interaction.reply({ content, ephemeral: true });
		});
	}
);
