const { PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { findOrCreateCompany } = require('../logic/companies');

const mainId = "config-server";
module.exports = new CommandWrapper(mainId, "Configure BountyBot settings for this server", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.Guild], 3000,
	(interaction, database, runMode) => {
		findOrCreateCompany(interaction.guild.id).then(([company]) => {
			const updatePayload = {};
			let content = "The following server settings have been configured:";

			const prefix = interaction.options.getString("notification");
			if (prefix !== null) {
				updatePayload.announcementPrefix = prefix === "(nothing)" ? "" : prefix;
				content += `\n- The announcment prefix was set to ${prefix}`;
			}

			company.update(updatePayload);
			interaction.reply({ content, flags: [MessageFlags.Ephemeral] });
		});
	}
).setOptions(
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
	}
);
