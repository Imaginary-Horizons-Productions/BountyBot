const { EmbedBuilder, Colors, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { Hunter } = require('../models/users/Hunter');
const { buildCompanyStatsEmbed, randomFooterTip, ihpAuthorPayload } = require('../util/embedUtil');
const { generateTextBar } = require('../util/textUtil');
const { Op } = require('sequelize');

const mainId = "stats";
module.exports = new CommandWrapper(mainId, "Get the BountyBot stats for yourself or someone else", null, false, [InteractionContextType.Guild], 3000,
	/** Get the BountyBot stats for yourself or someone else */
	(interaction, database, runMode) => {
		const target = interaction.options.getMember("bounty-hunter");
		if (target) {
			if (target.id === interaction.client.user.id) {
				// BountyBot
				buildCompanyStatsEmbed(interaction.guild, database).then(embed => {
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
					const mostSecondedToast = await database.models.Toast.findOne({ where: { senderId: target.id, companyId: interaction.guildId, secondings: { [Op.gt]: 0 } }, order: [["secondings", "DESC"]] })

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
						ephemeral: true
					});
				})
			}
		} else {
			// Self
			database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } }).then(async hunter => {
				if (!hunter) {
					interaction.reply({ content: "You don't seem to have a profile with this server's BountyBot yet. It'll be created when you gain XP.", ephemeral: true });
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
				const mostSecondedToast = await database.models.Toast.findOne({ where: { senderId: interaction.user.id, companyId: interaction.guildId, secondings: { [Op.gt]: 0 } }, order: [["secondings", "DESC"]] })

				interaction.reply({
					embeds: [
						new EmbedBuilder().setColor(Colors[hunter.profileColor])
							.setAuthor(ihpAuthorPayload)
							.setThumbnail(interaction.user.avatarURL())
							.setTitle(`You are __Level ${hunter.level}__ in ${interaction.guild.name}`)
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
					ephemeral: true
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
);