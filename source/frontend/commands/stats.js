const { EmbedBuilder, Colors, InteractionContextType, MessageFlags, unorderedList, underline, italic } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { Hunter } = require('../../database/models');
const { randomFooterTip, ihpAuthorPayload, fillableTextBar, companyStatsEmbed, hunterProfileEmbed } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "stats";
module.exports = new CommandWrapper(mainId, "Get the BountyBot stats for yourself or someone else", null, false, [InteractionContextType.Guild], 3000,
	/** Get the BountyBot stats for yourself or someone else */
	async (interaction, origin, runMode) => {
		const target = interaction.options.getMember("bounty-hunter");
		const guild = interaction.guild;
		const [currentSeason] = await logicLayer.seasons.findOrCreateCurrentSeason(guild.id);
		if (target) {
			if (target.id === interaction.client.user.id) {
				// BountyBot
				const hunterMap = await logicLayer.hunters.getCompanyHunterMap(guild.id);
				const lastSeason = await logicLayer.seasons.findOneSeason(guild.id, "previous");
				const participantCount = await logicLayer.seasons.getParticipantCount(currentSeason.id);
				companyStatsEmbed(guild, origin.company.getXP(hunterMap), participantCount, currentSeason, lastSeason).then(embed => {
					interaction.reply({
						embeds: [embed],
						flags: MessageFlags.Ephemeral
					});
				})
			} else {
				// Other Hunter
				logicLayer.hunters.findOneHunter(target.id, guild.id).then(async hunter => {
					if (!hunter) {
						interaction.reply({ content: "The specified user doesn't seem to have a profile with this server's BountyBot yet. It'll be created when they gain XP.", flags: MessageFlags.Ephemeral });
						return;
					}

					const currentHunterLevel = hunter.getLevel(origin.company.xpCoefficient);
					const currentLevelThreshold = Hunter.xpThreshold(currentHunterLevel, origin.company.xpCoefficient);
					const nextLevelThreshold = Hunter.xpThreshold(currentHunterLevel + 1, origin.company.xpCoefficient);
					const participations = await logicLayer.seasons.findHunterParticipations(hunter.userId, hunter.companyId);
					const currentParticipation = participations.find(participation => participation.seasonId === currentSeason.id);
					const previousParticipations = currentParticipation === null ? participations : participations.slice(1);
					const ranks = await logicLayer.ranks.findAllRanks(guild.id);
					let rankName = null;
					if (currentParticipation && ranks.length > 0) {
						rankName = ranks[currentParticipation.rankIndex].getMention(currentParticipation.rankIndex);
					}
					const mostSecondedToast = await logicLayer.toasts.findMostSecondedToast(target.id, guild.id);

					interaction.reply({
						embeds: [hunterProfileEmbed(hunter, target, currentHunterLevel, currentLevelThreshold, nextLevelThreshold, currentParticipation, rankName, previousParticipations, mostSecondedToast)],
						flags: MessageFlags.Ephemeral
					});
				})
			}
		} else {
			// Self
			const currentHunterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
			const currentLevelThreshold = Hunter.xpThreshold(currentHunterLevel, origin.company.xpCoefficient);
			const nextLevelThreshold = Hunter.xpThreshold(currentHunterLevel + 1, origin.company.xpCoefficient);
			const bountySlots = Hunter.getBountySlotCount(currentHunterLevel, origin.company.maxSimBounties);
			const participations = await logicLayer.seasons.findHunterParticipations(origin.hunter.userId, origin.hunter.companyId);
			const currentParticipation = participations.find(participation => participation.seasonId === currentSeason.id);
			const previousParticipations = currentParticipation === null ? participations : participations.slice(1);
			const ranks = await logicLayer.ranks.findAllRanks(interaction.guildId);
			let rankName = null;
			if (currentParticipation && ranks.length > 0) {
				const rankIndex = currentParticipation.rankIndex;
				rankName = ranks[rankIndex].getMention(rankIndex);
			}
			const mostSecondedToast = await logicLayer.toasts.findMostSecondedToast(interaction.user.id, guild.id);
			const nextRankXP = await logicLayer.seasons.nextRankXP(interaction.user.id, currentSeason, ranks);
			let nextRankName = null;
			if (ranks.length > 0) {
				const nextRankIndex = Math.max((currentParticipation?.rankIndex ?? ranks.length) - 1, 0);
				nextRankName = ranks[nextRankIndex].getMention(nextRankIndex);
			}

			let description = `${fillableTextBar(origin.hunter.xp - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)} ${italic("Next Level:")} ${nextLevelThreshold - origin.hunter.xp} XP`;
			if (currentParticipation) {
				description += `\nYou have earned ${italic(`${currentParticipation.xp} XP`)} this season`;
				if (rankName) {
					description += ` which qualifies for ${rankName}`;
				}
			} else {
				description += `\nYou have earned ${italic("0 XP")} this season`;
			}
			if (nextRankXP > 0 && nextRankName) {
				description += `\nYou'll need ${nextRankXP} more XP to reach ${nextRankName}`
			}
			description += `\n\nYou have ${bountySlots} bounty slot${bountySlots === 1 ? '' : 's'}!`;

			interaction.reply({
				embeds: [
					new EmbedBuilder().setColor(Colors[origin.hunter.profileColor])
						.setAuthor(ihpAuthorPayload)
						.setThumbnail(interaction.user.avatarURL())
						.setTitle(`You are ${underline(`Level ${currentHunterLevel}`)} in ${guild.name}`)
						.setDescription(description)
						.addFields(
							{ name: "Season Placements", value: `Currently: ${(currentParticipation?.placement ?? 0) === 0 ? "Unranked" : "#" + currentParticipation.placement}\n${previousParticipations.length > 0 ? `Previous Placements: ${previousParticipations.map(participation => `#${participation.placement}`).join(", ")}` : ""}`, inline: true },
							{ name: "Total XP Earned", value: `${origin.hunter.xp} XP`, inline: true },
							{ name: "Most Seconded Toast", value: mostSecondedToast ? `"${mostSecondedToast.text}" with **${mostSecondedToast.secondings} secondings**` : "No toasts seconded yet..." },
							{ name: "Bounty Stats", value: `Bounties Hunted: ${origin.hunter.othersFinished} bount${origin.hunter.othersFinished === 1 ? 'y' : 'ies'}\nBounty Postings: ${origin.hunter.mineFinished} bount${origin.hunter.mineFinished === 1 ? 'y' : 'ies'}`, inline: true },
							{ name: "Toast Stats", value: `Toasts Raised: ${origin.hunter.toastsRaised} toast${origin.hunter.toastsRaised === 1 ? "" : "s"}\nToasts Seconded: ${origin.hunter.toastsSeconded} toast${origin.hunter.toastsSeconded === 1 ? "" : "s"}\nToasts Recieved: ${origin.hunter.toastsReceived} toast${origin.hunter.toastsReceived === 1 ? "" : "s"}`, inline: true },
							{
								name: "Upcoming Level-Up Rewards", value: [currentHunterLevel + 1, currentHunterLevel + 2, currentHunterLevel + 3].map(level => `Level ${level}\n${unorderedList(Hunter.getLevelUpRewards(level, origin.company.maxSimBounties).map(([kind, value]) => {
									switch (kind) {
										case "bountySlotUnlocked":
											return `You will unlock Bounty Slot #${value}.`;
										case "oddSlotBaseRewardIncrease":
											return `The base reward of your odd-numbered bounty slots will increase (max: ${value} Reward XP in Slot #1)!`;
										case "evenSlotBaseRewardIncrease":
											return `The base reward of your even-numbered bounty slots will increase (max: ${value} Reward XP in Slot #2)!`;
									}
								}))}`).join("\n")
							}
						)
						.setFooter(randomFooterTip())
						.setTimestamp()
				],
				flags: MessageFlags.Ephemeral
			});
		}
	}
).setOptions(
	{
		type: "User",
		name: "bounty-hunter",
		description: "Whose stats to check; BountyBot for the server stats, empty for yourself",
		required: false
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
