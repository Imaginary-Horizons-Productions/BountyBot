const { PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { GLOBAL_MAX_BOUNTY_SLOTS } = require('../constants');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "config-premium";
module.exports = new CommandWrapper(mainId, "Configure premium BountyBot settings for this server", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	(interaction, runMode) => {
		logicLayer.companies.findOrCreateCompany(interaction.guild.id).then(([company]) => {
			const updatePayload = {};
			let content = "The following server settings have been configured:";
			const errors = [];

			const xpCoefficient = interaction.options.getNumber("level-threshold-multiplier");
			if (xpCoefficient !== null) {
				updatePayload.xpCoefficient = xpCoefficient;
				content += `\n- The level-up xp coefficient has been set to ${xpCoefficient}.`;
			}

			const slots = interaction.options.getInteger("bounty-slots");
			if (slots !== null) {
				if (slots < 1 || slots > GLOBAL_MAX_BOUNTY_SLOTS) {
					interaction.reply({ content: `Your settings were not set because ${slots} is an invalid value for bounty slots (must be between 1 and 10 inclusive).`, flags: [MessageFlags.Ephemeral] });
					return;
				}
				updatePayload.maxSimBounties = slots;
				content += `\n- Max bounty slots a bounty hunter can have (including earned slots) has been set to ${slots}.`;
			}

			const toastThumbnailURL = interaction.options.getString("toast-thumbnail-url");
			if (toastThumbnailURL) {
				try {
					new URL(toastThumbnailURL);
					updatePayload.toastThumbnailURL = toastThumbnailURL;
					content += `\n- The toast thumbnail was set to <${toastThumbnailURL}>.`;
				} catch (error) {
					errors.push(error.message);
				}
			}

			const openBountyThumbnailURL = interaction.options.getString("open-bounty-thumbnail-url");
			if (openBountyThumbnailURL) {
				try {
					new URL(openBountyThumbnailURL);
					updatePayload.openBountyThumbnailURL = openBountyThumbnailURL;
					content += `\n- The open bounty thumbnail was set to <${openBountyThumbnailURL}>.`;
				} catch (error) {
					errors.push(error.message);
				}
			}

			const completedBountyThumbnailURL = interaction.options.getString("completed-bounty-thumbnail-url");
			if (completedBountyThumbnailURL) {
				try {
					new URL(completedBountyThumbnailURL);
					updatePayload.completedBountyThumbnailURL = completedBountyThumbnailURL;
					content += `\n- The completed bounty thumbnail was set to <${completedBountyThumbnailURL}>.`;
				} catch (error) {
					errors.push(error.message);
				}
			}

			const scoreboardThumbnailURL = interaction.options.getString("scoreboard-thumbnail-url");
			if (scoreboardThumbnailURL) {
				try {
					new URL(scoreboardThumbnailURL);
					updatePayload.scoreboardThumbnailURL = scoreboardThumbnailURL;
					content += `\n- The scoreboard thumbnail was set to <${scoreboardThumbnailURL}>.`;
				} catch (error) {
					errors.push(error.message);
				}
			}

			const serverBonusesThumbnailURL = interaction.options.getString("server-bonuses-thumbnail-url");
			if (serverBonusesThumbnailURL) {
				try {
					new URL(serverBonusesThumbnailURL);
					updatePayload.serverBonusesThumbnailURL = serverBonusesThumbnailURL;
					content += `\n- The server bonuses thumbnail was set to <${serverBonusesThumbnailURL}>.`;
				} catch (error) {
					errors.push(error.message);
				}
			}

			company.update(updatePayload);
			if (errors.length > 0) {
				content += `\n\nThe following errors were encountered:\n- ${errors.join("\n- ")}`;
			}
			interaction.reply({ content, flags: [MessageFlags.Ephemeral] });
		});
	}
).setOptions(
	{
		type: "Number",
		name: "level-threshold-multiplier",
		description: "Configure the XP coefficient for bounty hunter levels (default 3)",
		required: false,
	},
	{
		type: "Integer",
		name: "bounty-slots",
		description: `Configure the max number (between 1 and ${GLOBAL_MAX_BOUNTY_SLOTS}) of bounty slots hunters can have (default 5)`,
		required: false
	},
	{
		type: "String",
		name: "toast-thumbnail-url",
		description: "Configure the image shown in the thumbnail of toasts",
		required: false
	},
	{
		type: "String",
		name: "open-bounty-thumbnail-url",
		description: "Configure the image shown in the thumbnail of open bounties",
		required: false
	},
	{
		type: "String",
		name: "completed-bounty-thumbnail-url",
		description: "Configure the image shown in the thumbnail of completed bounties",
		required: false
	},
	{
		type: "String",
		name: "scoreboard-thumbnail-url",
		description: "Configure the image shown in the thumbnail of the scoreboard",
		required: false
	},
	{
		type: "String",
		name: "server-bonuses-thumbnail-url",
		description: "Configure the image shown in the thumbnail of the server bonuses message",
		required: false
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
