import { InteractionContextType, MessageFlags, PermissionFlagsBits, unorderedList } from 'discord.js';
import { GLOBAL_MAX_BOUNTY_SLOTS, MAX_BOT_NICKNAME_LENGTH } from '../../shared/constants';
import { CommandFunctionality } from '../classes';
import { updateBotNicknameForFestival } from '../shared';

const mainId = "config-premium";
export default new CommandFunctionality(mainId, "Configure premium BountyBot settings for this server", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		const updatePayload = {};
		let content = "The following server settings have been configured:";
		const errors = [];

		const nickname = interaction.options.getString("nickname");
		if (nickname !== null) {
			if (nickname.length > MAX_BOT_NICKNAME_LENGTH) {
				errors.push(`\`${nickname}\` could not be set for Nickname. \`${nickname}\` is ${nickname.length} characters long, but cannot be longer than ${MAX_BOT_NICKNAME_LENGTH}.`);
			} else {
				updatePayload.nickname = nickname;
				interaction.guild.members.fetchMe().then(bountybotGuildMember => {
					updateBotNicknameForFestival(bountybotGuildMember, theater.company);
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

		theater.company.update(updatePayload);
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
	}
);
