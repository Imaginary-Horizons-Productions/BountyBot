import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBooleanOption, SlashCommandStringOption } from 'discord.js';
import { DatabaseTypes } from '../../database';
import { CommandFunctionality } from '../classes';

const notificationOption = new SlashCommandStringOption().setName("notification")
	.setDescription("Configure who to send notifications to (default @here)")
	.setChoices(
		{ name: "Notify online members (@here)", value: "@here" },
		{ name: "Notify all members (@everyone)", value: "@everyone" },
		{ name: "No prefix", value: "(nothing)" },
		{ name: "Suppress notifications (@silent)", value: "@silent" }
	);

const disableReactionToastsOption = new SlashCommandBooleanOption().setName("disable-reaction-toasts")
	.setDescription("Toggle whether reacting with 🥂 to quickly raise a toast");

const mainId = "config-server";
export default new CommandFunctionality(mainId, "Configure BountyBot settings for this server", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		const updatePayload: Partial<DatabaseTypes.Company> = {};
		let content = "The following server settings have been configured:";

		const prefix = interaction.options.getString(notificationOption.name);
		if (prefix !== null) {
			updatePayload.announcementPrefix = prefix === notificationOption.choices?.[2].value ? "" : prefix;
			content += `\n- The announcment prefix was set to ${prefix}`;
		}

		const disableReactionToasts = interaction.options.getBoolean(disableReactionToastsOption.name);
		if (disableReactionToasts !== null) {
			updatePayload.disableReactionToasts = disableReactionToasts;
			content += `\n- Reaction Toasts were set to ${disableReactionToasts ? "dis" : ""}allowed`;
		}

		theater.company.update(updatePayload);
		interaction.reply({ content, flags: MessageFlags.Ephemeral });
	}
).setOptions(
	notificationOption,
	disableReactionToastsOption
);
