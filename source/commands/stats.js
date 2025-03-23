const { EmbedBuilder, Colors, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { Hunter } = require('../models/users/Hunter');
const { randomFooterTip, ihpAuthorPayload } = require('../util/embedUtil');
const { generateTextBar } = require('../util/textUtil');
const { COMPANY_XP_COEFFICIENT } = require('../constants');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "stats";
module.exports = new CommandWrapper(mainId, "Get the BountyBot stats for yourself or someone else", null, false, [InteractionContextType.Guild], 3000,
	/** Get the BountyBot stats for yourself or someone else */
	async (interaction, runMode) => {
		const target = interaction.options.getMember("bounty-hunter");
		const guild = interaction.guild;
		if (target) {
			if (target.id === interaction.client.user.id) {
				// BountyBot
				const [company] = await logicLayer.companies.findOrCreateCompany(guild.id);
				const currentLevelThreshold = Hunter.xpThreshold(company.level, COMPANY_XP_COEFFICIENT);
				const nextLevelThreshold = Hunter.xpThreshold(company.level + 1, COMPANY_XP_COEFFICIENT);
				const [currentSeason] = await logicLayer.seasons.findOrCreateCurrentSeason(guild.id);
				const lastSeason = await logicLayer.seasons.findOneSeason(guild.id, "previous");
				const participantCount = await logicLayer.seasons.getParticipantCount(currentSeason.id);
				company.statsEmbed(guild, participantCount, currentLevelThreshold, nextLevelThreshold, currentSeason, lastSeason).then(embed => {
					interaction.reply({
						embeds: [embed],
						flags: [MessageFlags.Ephemeral]
					});
				})
			} else {
				// Other Hunter
				logicLayer.hunters.findOneHunter(target.id, guild.id).then(async hunter => {
					if (!hunter) {
						interaction.reply({ content: "The specified user doesn't seem to have a profile with this server's BountyBot yet. It'll be created when they gain XP.", flags: [MessageFlags.Ephemeral] });
						return;
					}

					const { xpCoefficient } = await logicLayer.companies.findCompanyByPK(guild.id);
					const currentLevelThreshold = Hunter.xpThreshold(hunter.level, xpCoefficient);
					const nextLevelThreshold = Hunter.xpThreshold(hunter.level + 1, xpCoefficient);
					const participations = await logicLayer.seasons.findHunterParticipations(hunter.userId, hunter.companyId);
					const [currentSeason] = await logicLayer.seasons.findOrCreateCurrentSeason(guild.id);
					const currentParticipation = participations.find(participation => participation.seasonId === currentSeason.id);
					const previousParticipations = currentParticipation === null ? participations : participations.slice(1);
					const ranks = await logicLayer.ranks.findAllRanks(guild.id);
					const rankName = ranks[hunter.rank]?.roleId ? `<@&${ranks[hunter.rank].roleId}>` : `Rank ${hunter.rank + 1}`;
					const mostSecondedToast = await logicLayer.toasts.findMostSecondedToast(target.id, guild.id);

					interaction.reply({
						embeds: [
							new EmbedBuilder().setColor(Colors[hunter.profileColor])
								.setAuthor(ihpAuthorPayload)
								.setThumbnail(target.user.avatarURL())
								.setTitle(`${target.displayName} is __Level ${hunter.level}__`)
								.setDescription(`${generateTextBar(hunter.xp - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}\nThey have earned *${currentParticipation?.xp ?? 0} XP* this season${hunter.rank !== null ? ` which qualifies for ${rankName}` : ""}.`)
								.addFields(
									{ name: "Season Placements", value: `Currently: ${(currentParticipation?.placement ?? 0) === 0 ? "Unranked" : "#" + currentParticipation.placement}\n${previousParticipations.length > 0 ? `Previous Placements: ${previousParticipations.map(participation => `#${participation.placement}`).join(", ")}` : ""}`, inline: true },
									{ name: "Total XP Earned", value: `${hunter.xp} XP`, inline: true },
									{ name: "Most Seconded Toast", value: mostSecondedToast ? `"${mostSecondedToast.text}" with **${mostSecondedToast.secondings} secondings**` : "No toasts seconded yet..." },
									{ name: "Bounty Stats", value: `Bounties Hunted: ${hunter.othersFinished} bount${hunter.othersFinished === 1 ? 'y' : 'ies'}\nBounty Postings: ${hunter.mineFinished} bount${hunter.mineFinished === 1 ? 'y' : 'ies'}`, inline: true },
									{ name: "Toast Stats", value: `Toasts Raised: ${hunter.toastsRaised} toast${hunter.toastsRaised === 1 ? "" : "s"}\nToasts Seconded: ${hunter.toastsSeconded} toast${hunter.toastsSeconded === 1 ? "" : "s"}\nToasts Recieved: ${hunter.toastsReceived} toast${hunter.toastsReceived === 1 ? "" : "s"}`, inline: true },
								)
								.setFooter(randomFooterTip())
								.setTimestamp()
						],
						flags: [MessageFlags.Ephemeral]
					});
				})
			}
		} else {
			// Self
			logicLayer.hunters.findOneHunter(interaction.user.id, guild.id).then(async hunter => {
				if (!hunter) {
					interaction.reply({ content: "You don't seem to have a profile with this server's BountyBot yet. It'll be created when you gain XP.", flags: [MessageFlags.Ephemeral] });
					return;
				}

				const { xpCoefficient, maxSimBounties } = await logicLayer.companies.findCompanyByPK(guild.id);
				const currentLevelThreshold = Hunter.xpThreshold(hunter.level, xpCoefficient);
				const nextLevelThreshold = Hunter.xpThreshold(hunter.level + 1, xpCoefficient);
				const bountySlots = hunter.maxSlots(maxSimBounties);
				const participations = await logicLayer.seasons.findHunterParticipations(hunter.userId, hunter.companyId);
				const [currentSeason] = await logicLayer.seasons.findOrCreateCurrentSeason(guild.id);
				const currentParticipation = participations.find(participation => participation.seasonId === currentSeason.id);
				const previousParticipations = currentParticipation === null ? participations : participations.slice(1);
				const ranks = await logicLayer.ranks.findAllRanks(interaction.guildId);
				const rankName = ranks[hunter.rank]?.roleId ? `<@&${ranks[hunter.rank].roleId}>` : `Rank ${hunter.rank + 1}`;
				const mostSecondedToast = await logicLayer.toasts.findMostSecondedToast(interaction.user.id, guild.id);

				interaction.reply({
					embeds: [
						new EmbedBuilder().setColor(Colors[hunter.profileColor])
							.setAuthor(ihpAuthorPayload)
							.setThumbnail(interaction.user.avatarURL())
							.setTitle(`You are __Level ${hunter.level}__ in ${guild.name}`)
							.setDescription(
								`${generateTextBar(hunter.xp - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)} *Next Level:* ${nextLevelThreshold - hunter.xp} XP\n\
								You have earned *${currentParticipation?.xp ?? 0} XP* this season${hunter.rank != null ? ` which qualifies for ${rankName}` : ""}.${hunter.nextRankXP > 0 ? `You need ${hunter.nextRankXP} XP to reach the next rank.` : ""}\n\n\
								You have ${bountySlots} bounty slot${bountySlots === 1 ? '' : 's'}!`
							)
							.addFields(
								{ name: "Season Placements", value: `Currently: ${(currentParticipation?.placement ?? 0) === 0 ? "Unranked" : "#" + currentParticipation.placement}\n${previousParticipations.length > 0 ? `Previous Placements: ${previousParticipations.map(participation => `#${participation.placement}`).join(", ")}` : ""}`, inline: true },
								{ name: "Total XP Earned", value: `${hunter.xp} XP`, inline: true },
								{ name: "Most Seconded Toast", value: mostSecondedToast ? `"${mostSecondedToast.text}" with **${mostSecondedToast.secondings} secondings**` : "No toasts seconded yet..." },
								{ name: "Bounty Stats", value: `Bounties Hunted: ${hunter.othersFinished} bount${hunter.othersFinished === 1 ? 'y' : 'ies'}\nBounty Postings: ${hunter.mineFinished} bount${hunter.mineFinished === 1 ? 'y' : 'ies'}`, inline: true },
								{ name: "Toast Stats", value: `Toasts Raised: ${hunter.toastsRaised} toast${hunter.toastsRaised === 1 ? "" : "s"}\nToasts Seconded: ${hunter.toastsSeconded} toast${hunter.toastsSeconded === 1 ? "" : "s"}\nToasts Recieved: ${hunter.toastsReceived} toast${hunter.toastsReceived === 1 ? "" : "s"}`, inline: true },
								{ name: "Upcoming Level-Up Rewards", value: [hunter.level + 1, hunter.level + 2, hunter.level + 3].map(level => `Level ${level}\n- ${hunter.levelUpReward(level, maxSimBounties, true).join("\n- ")}`).join("\n") }
							)
							.setFooter(randomFooterTip())
							.setTimestamp()
					],
					flags: [MessageFlags.Ephemeral]
				});
			})
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
