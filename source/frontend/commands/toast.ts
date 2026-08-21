import type { Snowflake } from "discord.js";
import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandAttachmentOption, SlashCommandStringOption, SlashCommandUserOption, unorderedList, userMention } from 'discord.js';
import { DatabaseTypes } from '../../database/index.ts';
import type { LogicLayer } from '../../logic/index.ts';
import type { CompanyReciept } from '../../shared/types.ts';
import { CommandFunctionality } from '../classes/index.ts';
import { consolidateHunterReceipts, goalCompletionEmbed, refreshReferenceChannelScoreboardOverall, refreshReferenceChannelScoreboardSeasonal, rewardSummary, secondingButtonRow, sendRewardMessage, sentenceListEN, syncRankRoles, textsHaveAutoModInfraction, toastEmbed } from '../shared/index.ts';

let logicLayer: LogicLayer;

const messageOption = new SlashCommandStringOption().setName("message")
	.setDescription("The text of the toast to raise")
	.setRequired(true);

const toasteeOption = new SlashCommandUserOption().setName("toastee")
	.setDescription("A bounty hunter you are toasting to")
	.setRequired(true);

const secondToasteeOption = new SlashCommandUserOption().setName("second-toastee")
	.setDescription("A bounty hunter you are toasting to")

const thirdToasteeOption = new SlashCommandUserOption().setName("third-toastee")
	.setDescription("A bounty hunter you are toasting to")

const fourthToasteeOption = new SlashCommandUserOption().setName("fourth-toastee")
	.setDescription("A bounty hunter you are toasting to")

const fifthToasteeOption = new SlashCommandUserOption().setName("fifth-toastee")
	.setDescription("A bounty hunter you are toasting to")

const imageOption = new SlashCommandAttachmentOption().setName("image-url")
	.setDescription("The image to add to the toast")

const mainId = "toast";
export default new CommandFunctionality(mainId, "Raise a toast to other bounty hunter(s), usually granting +1 XP", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 30000,
	/** Provide 1 XP to mentioned hunters up to author's quota (10/48 hours), roll for crit toast (grants author XP) */
	async (interaction, theater, isDevMode) => {
		// Find valid toastees
		const bannedIds = new Set<Snowflake>();
		const validatedToasteeIds = new Set<Snowflake>();
		for (const option of [toasteeOption, secondToasteeOption, thirdToasteeOption, fourthToasteeOption, fifthToasteeOption]) {
			const guildMember = interaction.options.getMember(option.name);
			if (guildMember) {
				const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(guildMember.id, interaction.guild.id);
				if (hunter.isBanned) {
					bannedIds.add(guildMember.id);
				} else if (isDevMode || (!guildMember.user.bot && guildMember.id !== interaction.user.id)) {
					validatedToasteeIds.add(guildMember.id);
				}
			}
		}

		let bannedText: string | undefined;
		if (bannedIds.size > 1) {
			bannedText = `${sentenceListEN(Array.from(bannedIds).map(id => userMention(id)))} were skipped because they're banned from using BountyBot on this server.`;
		} else if (bannedIds.size === 1) {
			bannedText = `${userMention(bannedIds.values().next().value)} was skipped because they're banned from using BountyBot on this server.`;
		}

		const errors = [];
		if (validatedToasteeIds.size < 1) {
			const sentences = ["No valid toastees received. You cannot raise a toast to yourself or a bot."];
			if (bannedText) {
				sentences.push(bannedText);
			}
			errors.push(sentences.join(" "));
		}

		// Early-out if any errors
		if (errors.length > 0) {
			interaction.reply({ content: `The following errors were encountered while raising your toast:\n${unorderedList(errors)}`, flags: MessageFlags.Ephemeral });
			return;
		}

		const toastText = interaction.options.getString(messageOption.name, true);
		const autoModInfraction = await textsHaveAutoModInfraction(interaction.channel, interaction.member, [toastText], "toast")
		if (autoModInfraction == null) {
			interaction.reply({ content: `Could not check if the toast breaks automod rules. ${interaction.client.user} may not have the Manage Server permission required to check the automod rules.`, flags: MessageFlags.Ephemeral });
			return;
		} else if (autoModInfraction) {
			interaction.reply({ content: "Your toast was blocked by AutoMod.", flags: MessageFlags.Ephemeral });
			return;
		}

		const season = await logicLayer.seasons.incrementSeasonStat(interaction.guild.id, "toastsRaised");
		let hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);

		const previousCompanyLevel = DatabaseTypes.Company.getLevel(theater.company.getXP(hunterMap));
		const attachment = interaction.options.getAttachment(imageOption.name);
		const { toastId, hunterReceipts } = await logicLayer.toasts.raiseToast(interaction.guild, theater.company, interaction.user.id, Array.from(validatedToasteeIds), hunterMap, season.id, toastText, attachment?.url);
		let goalProgress = { goalCompleted: false, currentGP: 0, requiredGP: 0 };
		let companyReceipt: CompanyReciept = {};
		if (hunterReceipts.size > 0) {
			const results = await logicLayer.goals.progressGoal(theater.company, "toasts", hunterMap.get(interaction.user.id), season);
			companyReceipt = results.companyReceipt;
			goalProgress = results.goalProgress;

			hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);
			const currentCompanyLevel = DatabaseTypes.Company.getLevel(theater.company.getXP(hunterMap));
			if (previousCompanyLevel < currentCompanyLevel) {
				companyReceipt.levelUp = currentCompanyLevel;
			}
		}
		companyReceipt.guildName = interaction.guild.name;

		const embeds = [toastEmbed(theater.company.toastThumbnailURL, toastText, Array.from(validatedToasteeIds), interaction.member, goalProgress, attachment?.url)];
		if (goalProgress.goalCompleted) {
			embeds.push(goalCompletionEmbed(goalProgress.contributorIds));
		}

		interaction.reply({
			embeds,
			components: [secondingButtonRow(toastId)],
			withResponse: true
		}).then(async response => {
			if (bannedText) {
				interaction.followUp({ content: bannedText, flags: MessageFlags.Ephemeral });
			}
			if (hunterReceipts.size > 0) {
				const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
				const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
				const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await interaction.guild.roles.fetch());
				syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);

				consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
				sendRewardMessage(response.resource.message, rewardSummary("toast", companyReceipt, hunterReceipts, theater.company.maxSimBounties), "Rewards");
				if (theater.company.scoreboardIsSeasonal) {
					refreshReferenceChannelScoreboardSeasonal(theater.company, interaction.guild, participationMap, descendingRanks, goalProgress);
				} else {
					refreshReferenceChannelScoreboardOverall(theater.company, interaction.guild, hunterMap, goalProgress);
				}
			}
		});
	}
).setOptions(
	messageOption,
	toasteeOption,
	secondToasteeOption,
	thirdToasteeOption,
	fourthToasteeOption,
	fifthToasteeOption,
	imageOption
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
