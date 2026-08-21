import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandIntegerOption, SlashCommandNumberOption, SlashCommandStringOption, unorderedList } from 'discord.js';
import type { DatabaseTypes } from '../../database/index.ts';
import { GLOBAL_MAX_BOUNTY_SLOTS, MAX_BOT_NICKNAME_LENGTH } from '../../shared/constants.ts';
import { CommandFunctionality } from '../classes/index.ts';
import { updateBotNicknameForFestival } from '../shared/index.ts';

const nicknameOption = new SlashCommandStringOption().setName("nickname")
	.setDescription("The nickname BountyBot should revert to after festivals end");

const levelThresholdMultiplierOption = new SlashCommandNumberOption().setName("level-threshold-multiplier")
	.setDescription("Configure the XP coefficient for bounty hunter levels (default 3)");

const bountySlotsOption = new SlashCommandIntegerOption().setName("bounty-slots")
	.setDescription(`Configure the max number (between 1 and ${GLOBAL_MAX_BOUNTY_SLOTS}) of bounty slots hunters can have (default 5)`);

const mainId = "config-premium";
export default new CommandFunctionality(mainId, "Configure premium BountyBot settings for this server", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		const updatePayload: Partial<DatabaseTypes.Company> = {};
		let content = "The following server settings have been configured:";
		const errors = [];

		const nickname = interaction.options.getString(nicknameOption.name);
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

		const xpCoefficient = interaction.options.getNumber(levelThresholdMultiplierOption.name);
		if (xpCoefficient !== null) {
			if (xpCoefficient <= 0) {
				errors.push(`${xpCoefficient} could not be set for Level Threshold Multiplier. It must be a number greater than 0.`)
			} else {
				updatePayload.xpCoefficient = xpCoefficient;
				content += `\n- The Level Threshold Multiplier has been set to ${xpCoefficient}.`;
			}
		}

		const slots = interaction.options.getInteger(bountySlotsOption.name);
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
	nicknameOption,
	levelThresholdMultiplierOption,
	bountySlotsOption
);
