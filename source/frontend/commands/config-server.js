const { PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');

const mainId = "config-server";
module.exports = new CommandWrapper(mainId, "Configure BountyBot settings for this server", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.Guild], 3000,
	(interaction, origin, runMode) => {
		const updatePayload = {};
		let content = "The following server settings have been configured:";

		const prefix = interaction.options.getString("notification");
		if (prefix !== null) {
			updatePayload.announcementPrefix = prefix === "(nothing)" ? "" : prefix;
			content += `\n- The announcment prefix was set to ${prefix}`;
		}

		const disableReactionToasts = interaction.options.getBoolean("disable-reaction-toasts", false);
		if (disableReactionToasts !== null) {
			updatePayload.disableReactionToasts = disableReactionToasts;
			content += `\n- Reaction Toasts were set to ${disableReactionToasts ? "dis" : ""}allowed`;
		}

		origin.company.update(updatePayload);
		interaction.reply({ content, flags: MessageFlags.Ephemeral });
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
	},
	{
		type: "Boolean",
		name: "allow-reaction-toasts",
		description: "Allow reacting with 🥂 to quickly raise a toast",
		required: false
	}
);
