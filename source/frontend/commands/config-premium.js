const { PermissionFlagsBits, InteractionContextType, MessageFlags, unorderedList } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { GLOBAL_MAX_BOUNTY_SLOTS } = require('../../constants');
const { GuildMemberLimits } = require('@sapphire/discord.js-utilities');
const { updateBotNicknameForFestival } = require('../shared');

const mainId = "config-premium";
module.exports = new CommandWrapper(mainId, "Configure premium BountyBot settings for this server", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	(interaction, origin, runMode) => {
		const updatePayload = {};
		let content = "The following server settings have been configured:";
		const errors = [];

		const nickname = interaction.options.getString("nickname");
		if (nickname !== null) {
			if (nickname.length > GuildMemberLimits.MaximumDisplayNameLength) {
				errors.push(`${nickname} could not be set for Nickname. Nicknames cannot be longer than ${GuildMemberLimits.MaximumDisplayNameLength}.`);
			} else {
				updatePayload.nickname = nickname;
				interaction.guild.members.fetchMe().then(bountybotGuildMember => {
					updateBotNicknameForFestival(bountybotGuildMember, origin.company);
				})
				content += `\n- This sever's nickname for BountyBot has been set to ${nickname}.`;
			}
		}

		const xpCoefficient = interaction.options.getNumber("level-threshold-multiplier");
		if (xpCoefficient !== null) {
			if (xpCoefficient <= 0) {
				errors.push(`${xpCoefficient} could not be set for Level Threshold Multiplier. It must be a number greater than 0.`)
			} else {
				updatePayload.xpCoefficient = xpCoefficient;
				content += `\n- The Level Threshold Multiplier has been set to ${xpCoefficient}.`;
			}
		}

		const slots = interaction.options.getInteger("bounty-slots");
		if (slots !== null) {
			if (slots < 1 || slots > GLOBAL_MAX_BOUNTY_SLOTS) {
				errors.push(`${slots} could not be set for Bounty Slots. It must be a number between 1 and ${GLOBAL_MAX_BOUNTY_SLOTS} (inclusive).`);
			} else {
				updatePayload.maxSimBounties = slots;
				content += `\n- Max bounty slots a bounty hunter can have (including earned slots) has been set to ${slots}.`;
			}
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

		const deletedBountyThumbnailURL = interaction.options.getString("deleted-bounty-thumbnail-url");
		if (deletedBountyThumbnailURL) {
			try {
				new URL(deletedBountyThumbnailURL);
				updatePayload.deletedBountyThumbnailURL = deletedBountyThumbnailURL;
				content += `\n- The deleted bounty thumbnail was set to <${deletedBountyThumbnailURL}>.`;
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

		const goalCompletionThumbnailURL = interaction.options.getString("goal-completion-thumbnail-url");
		if (goalCompletionThumbnailURL) {
			try {
				new URL(goalCompletionThumbnailURL);
				updatePayload.goalCompletionThumbnailURL = goalCompletionThumbnailURL;
				content += `\n- The server bonuses thumbnail was set to <${goalCompletionThumbnailURL}>.`;
			} catch (error) {
				errors.push(error.message);
			}
		}

		const raffleThumbnailURL = interaction.options.getString("raffle-thumbnail-url");
		if (raffleThumbnailURL) {
			try {
				new URL(raffleThumbnailURL);
				updatePayload.raffleThumbnailURL = raffleThumbnailURL;
				content += `\n- The server bonuses thumbnail was set to <${raffleThumbnailURL}>.`;
			} catch (error) {
				errors.push(error.message);
			}
		}

		origin.company.update(updatePayload);
		if (errors.length > 0) {
			content += `\n\nThe following errors were encountered:\n${unorderedList(errors)}`;
		}
		interaction.reply({ content, flags: MessageFlags.Ephemeral });
	}
).setOptions(
	{
		type: "String",
		name: "nickname",
		description: "The nickname BountyBot should revert to after festivals end",
		required: false
	},
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
		description: "Set a url pointing to an image to use as thumbnail on toasts",
		required: false
	},
	{
		type: "String",
		name: "open-bounty-thumbnail-url",
		description: "Set a url pointing to an image to use as thumbnail on open bounties",
		required: false
	},
	{
		type: "String",
		name: "completed-bounty-thumbnail-url",
		description: "Set a url pointing to an image to use as thumbnail on completed bounties",
		required: false
	},
	{
		type: "String",
		name: "deleted-bounty-thumbnail-url",
		description: "Set a url pointing to an image to use as thumbnail on deleted bounties",
		required: false
	},
	{
		type: "String",
		name: "scoreboard-thumbnail-url",
		description: "Set a url pointing to an image to use as thumbnail on the scoreboard",
		required: false
	},
	{
		type: "String",
		name: "goal-completion-thumbnail-url",
		description: "Set a url pointing to an image to use as thumbnail in server goal completion messages",
		required: false
	},
	{
		type: "String",
		name: "raffle-thumbnail-url",
		description: "Set a url pointing to an image to use as thumbnail in raffle winner messages",
		required: false
	}
);
