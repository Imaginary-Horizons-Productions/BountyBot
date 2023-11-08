const { EmbedBuilder } = require('discord.js');
const { Op } = require('sequelize');
const { ZERO_WIDTH_WHITE_SPACE } = require('../constants');
const { CommandWrapper } = require('../classes');
const { Hunter } = require('../models/users/Hunter');
const { database } = require('../../database');
const { buildCompanyStatsEmbed, randomFooterTip, ihpAuthorPayload } = require('../util/embedUtil');
const { generateTextBar } = require('../util/textUtil');

const mainId = "stats";
const options = [
	{
		type: "User",
		name: "bounty-hunter",
		description: "Whose stats to check; BountyBot for the server stats, empty for yourself",
		required: false
	}
];
const subcommands = [];
module.exports = new CommandWrapper(mainId, "Get the BountyBot stats for yourself or someone else", null, false, false, 3000, options, subcommands,
	/** Get the BountyBot stats for yourself or someone else */
	(interaction) => {
		const target = interaction.options.getMember("bounty-hunter");
		if (target && target.id !== interaction.user.id) {
			if (target.id == interaction.client.user.id) {
				// BountyBot
				buildCompanyStatsEmbed(interaction.guild).then(embed => {
					interaction.reply({
						embeds: [embed],
						ephemeral: true
					});
				})
			} else {
				// Other Hunter
				database.models.Hunter.findOne({ where: { userId: target.id, companyId: interaction.guildId } }).then(async hunter => {
					if (!hunter) {
						interaction.reply({ content: "The specified user doesn't seem to have a profile with this server's BountyBot yet. It'll be created when they gain XP.", ephemeral: true });
						return;
					}

					const { xpCoefficient } = await database.models.Company.findByPk(interaction.guildId);
					const currentLevelThreshold = Hunter.xpThreshold(hunter.level, xpCoefficient);
					const nextLevelThreshold = Hunter.xpThreshold(hunter.level + 1, xpCoefficient);
					const participations = await database.models.Participation.findAll({ where: { userId: hunter.userId, companyId: hunter.companyId }, order: [["createdAt", "DESC"]] });
					const [currentSeason] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
					const currentParticipation = participations.find(participation => participation.seasonId === currentSeason.id);
					const previousParticipations = currentParticipation === null ? participations : participations.slice(1);
					const ranks = await database.models.Rank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "DESC"]] });
					const rankName = ranks[hunter.rank]?.roleId ? `<@&${ranks[hunter.rank].roleId}>` : `Rank ${hunter.rank + 1}`;

					//TODO #80 add "most seconded toast"
					interaction.reply({
						embeds: [
							new EmbedBuilder().setColor(target.displayColor)
								.setAuthor(ihpAuthorPayload)
								.setThumbnail(target.user.avatarURL())
								.setTitle(`${target.displayName} is __Level ${hunter.level}__`)
								.setDescription(`${generateTextBar(hunter.xp - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}\nThey have earned *${currentParticipation?.xp ?? 0} XP* this season${hunter.rank !== null ? ` which qualifies for ${rankName}` : ""}.`)
								.addFields(
									{ name: "Season Placements", value: `Currently: ${(currentParticipation?.placement ?? 0) === 0 ? "Unranked" : "#" + currentParticipation.placement}\n${previousParticipations.length > 0 ? `Previous Placements: ${previousParticipations.map(participation => `#${participation.placement}`).join(", ")}` : ""}` },
									{ name: "Bounties Hunted", value: `${hunter.othersFinished} bount${hunter.othersFinished === 1 ? 'y' : 'ies'}`, inline: true },
									{ name: "Bounty Postings", value: `${hunter.mineFinished} bount${hunter.mineFinished === 1 ? 'y' : 'ies'}`, inline: true },
									{ name: "Total XP Earned", value: `${hunter.xp} XP`, inline: true },
									{ name: ZERO_WIDTH_WHITE_SPACE, value: ZERO_WIDTH_WHITE_SPACE },
									{ name: "Toasts Raised", value: `${hunter.toastsRaised} toast${hunter.toastsRaised === 1 ? "" : "s"}`, inline: true },
									{ name: "Toasts Seconded", value: `${hunter.toastsSeconded} toast${hunter.toastsSeconded === 1 ? "" : "s"}`, inline: true },
									{ name: "Toasts Recieved", value: `${hunter.toastsReceived} toast${hunter.toastsReceived === 1 ? "" : "s"}`, inline: true },
								)
								.setFooter(randomFooterTip())
								.setTimestamp()
						],
						ephemeral: true
					});
				})
			}
		} else {
			// Self
			database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } }).then(async hunter => {
				if (!hunter) {
					interaction.reply("You don't seem to have a profile with this server's BountyBot yet. It'll be created when you gain XP.");
					return;
				}

				const { xpCoefficient, maxSimBounties } = await database.models.Company.findByPk(interaction.guildId);
				const currentLevelThreshold = Hunter.xpThreshold(hunter.level, xpCoefficient);
				const nextLevelThreshold = Hunter.xpThreshold(hunter.level + 1, xpCoefficient);
				const bountySlots = hunter.maxSlots(maxSimBounties);
				const participations = await database.models.Participation.findAll({ where: { userId: hunter.userId, companyId: hunter.companyId }, order: [["createdAt", "DESC"]] });
				const [currentSeason] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
				const currentParticipation = participations.find(participation => participation.seasonId === currentSeason.id);
				const previousParticipations = currentParticipation === null ? participations : participations.slice(1);
				const ranks = await database.models.Rank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "DESC"]] });
				const rankName = ranks[hunter.rank]?.roleId ? `<@&${ranks[hunter.rank].roleId}>` : `Rank ${hunter.rank + 1}`;

				//TODO #80 add "most seconded toast"
				interaction.reply({
					embeds: [
						new EmbedBuilder().setColor(interaction.member.displayColor)
							.setAuthor(ihpAuthorPayload)
							.setThumbnail(interaction.user.avatarURL())
							.setTitle(`You are __Level ${hunter.level}__ in ${interaction.guild.name}`)
							.setDescription(
								`${generateTextBar(hunter.xp - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)} *Next Level:* ${nextLevelThreshold - hunter.xp} XP\n\
								You have earned *${currentParticipation?.xp ?? 0} XP* this season${hunter.rank != null ? ` which qualifies for ${rankName}` : ""}.${hunter.nextRankXP > 0 ? `You need ${hunter.nextRankXP} XP to reach the next rank.` : ""}\n\n\
								You have ${bountySlots} bounty slot${bountySlots === 1 ? '' : 's'}!`
							)
							.addFields(
								{ name: "Season Placements", value: `Currently: ${(currentParticipation?.placement ?? 0) === 0 ? "Unranked" : "#" + currentParticipation.placement}\n${previousParticipations.length > 0 ? `Previous Placements: ${previousParticipations.map(participation => `#${participation.placement}`).join(", ")}` : ""}` },
								{ name: `Level ${hunter.level + 1} Reward`, value: hunter.levelUpReward(hunter.level + 1, maxSimBounties, true), inline: true },
								{ name: `Level ${hunter.level + 2} Reward`, value: hunter.levelUpReward(hunter.level + 2, maxSimBounties, true), inline: true },
								{ name: `Level ${hunter.level + 3} Reward`, value: hunter.levelUpReward(hunter.level + 3, maxSimBounties, true), inline: true },
								{ name: ZERO_WIDTH_WHITE_SPACE, value: ZERO_WIDTH_WHITE_SPACE },
								{ name: "Bounties Hunted", value: `${hunter.othersFinished} bount${hunter.othersFinished === 1 ? 'y' : 'ies'}`, inline: true },
								{ name: "Bounty Postings", value: `${hunter.mineFinished} bount${hunter.mineFinished === 1 ? 'y' : 'ies'}`, inline: true },
								{ name: "Total XP Earned", value: `${hunter.xp} XP`, inline: true },
								{ name: ZERO_WIDTH_WHITE_SPACE, value: ZERO_WIDTH_WHITE_SPACE },
								{ name: "Toasts Raised", value: `${hunter.toastsRaised} toast${hunter.toastsRaised === 1 ? "" : "s"}`, inline: true },
								{ name: "Toasts Seconded", value: `${hunter.toastsSeconded} toast${hunter.toastsSeconded === 1 ? "" : "s"}`, inline: true },
								{ name: "Toasts Recieved", value: `${hunter.toastsReceived} toast${hunter.toastsReceived === 1 ? "" : "s"}`, inline: true },
							)
							.setFooter(randomFooterTip())
							.setTimestamp()
					],
					ephemeral: true
				});
			})
		}
	}
);
