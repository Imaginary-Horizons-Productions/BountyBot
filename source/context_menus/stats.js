const { PermissionFlagBits, InteractionContextType } = require('discord.js');
const { buildCompanyStatsEmbed, randomFooterTip, ihpAuthorPayload } = require('../util/embedUtil');
const { generateTextBar } = require('../util/textUtil');
const { UserContextMenuWrapper } = require('../classes');
const { statsForUser } = require('../logic/stats.js');

const mainId = "BountyBot Stats";
module.exports = new UserContextMenuWrapper(mainId, null, false, [ InteractionContextType.Guild ], 3000,
	/** Specs */
	(interaction, database, runMode) => {
		const target = interaction.targetMember;
		if (target) {
			if (target.id == interaction.client.user.id) {
				// BountyBot
				buildCompanyStatsEmbed(interaction.guild, database).then(embed => {
					interaction.reply({
						embeds: [embed],
						ephemeral: true
					});
				})
			} else {
				// Other Hunter
				try {
					const {
						profileColor,
						hunterLevel,
						hunterXP,
						currentLevelThreshold,
						nextLevelThreshold,
						currentParticipation,
						rank,
						rankName,
						previousParticipations,
						mostSecondedToast,
						othersFinished,
						mineFinished,
						toastsRaised,
						toastsSeconded,
						toastsReceived
	
					} = statsForUser(target.id, interaction.guildId, database);
	
					interaction.reply({
						embeds: [
							new EmbedBuilder().setColor(Colors[profileColor])
								.setAuthor(ihpAuthorPayload)
								.setThumbnail(target.user.avatarURL())
								.setTitle(`${target.displayName} is __Level ${hunterLevel}__`)
								.setDescription(`${generateTextBar(hunterXP - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}\nThey have earned *${currentParticipation?.xp ?? 0} XP* this season${rank !== null ? ` which qualifies for ${rankName}` : ""}.`)
								.addFields(
									{ name: "Season Placements", value: `Currently: ${(currentParticipation?.placement ?? 0) === 0 ? "Unranked" : "#" + currentParticipation.placement}\n${previousParticipations.length > 0 ? `Previous Placements: ${previousParticipations.map(participation => `#${participation.placement}`).join(", ")}` : ""}`, inline: true },
									{ name: "Total XP Earned", value: `${hunterXP} XP`, inline: true },
									{ name: "Most Seconded Toast", value: mostSecondedToast ? `"${mostSecondedToast.text}" with **${mostSecondedToast.secondings} secondings**` : "No toasts seconded yet..." },
									{ name: "Bounty Stats", value: `Bounties Hunted: ${othersFinished} bount${othersFinished === 1 ? 'y' : 'ies'}\nBounty Postings: ${mineFinished} bount${mineFinished === 1 ? 'y' : 'ies'}`, inline: true },
									{ name: "Toast Stats", value: `Toasts Raised: ${toastsRaised} toast${toastsRaised === 1 ? "" : "s"}\nToasts Seconded: ${toastsSeconded} toast${toastsSeconded === 1 ? "" : "s"}\nToasts Recieved: ${toastsReceived} toast${toastsReceived === 1 ? "" : "s"}`, inline: true },
								)
								.setFooter(randomFooterTip())
								.setTimestamp()
						],
						ephemeral: true
					});
				} catch (message) {
					interaction.reply({ content: message, ephemeral: true });
					return;
				}
			}
		} else {
			// Self
			try {
				const {
					profileColor,
					hunterLevel,
					hunterXP,
					bountySlots,
					currentLevelThreshold,
					nextLevelThreshold,
					currentParticipation,
					rank,
					rankName,
					previousParticipations,
					mostSecondedToast,
					othersFinished,
					mineFinished,
					toastsRaised,
					toastsSeconded,
					toastsReceived,
					upcomingRewards

				} = statsForUser(interaction.user.id, interaction.guildId, database);

				interaction.reply({
					embeds: [
						new EmbedBuilder().setColor(Colors[profileColor])
							.setAuthor(ihpAuthorPayload)
							.setThumbnail(interaction.user.avatarURL())
							.setTitle(`You are __Level ${hunterLevel}__ in ${interaction.guild.name}`)
							.setDescription(
								`${generateTextBar(hunterXP - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)} *Next Level:* ${nextLevelThreshold - hunterXP} XP\n\
								You have earned *${currentParticipation?.xp ?? 0} XP* this season${rank != null ? ` which qualifies for ${rankName}` : ""}.${nextRankXP > 0 ? `You need ${nextRankXP} XP to reach the next rank.` : ""}\n\n\
								You have ${bountySlots} bounty slot${bountySlots === 1 ? '' : 's'}!`
							)
							.addFields(
								{ name: "Season Placements", value: `Currently: ${(currentParticipation?.placement ?? 0) === 0 ? "Unranked" : "#" + currentParticipation.placement}\n${previousParticipations.length > 0 ? `Previous Placements: ${previousParticipations.map(participation => `#${participation.placement}`).join(", ")}` : ""}`, inline: true },
								{ name: "Total XP Earned", value: `${hunterXP} XP`, inline: true },
								{ name: "Most Seconded Toast", value: mostSecondedToast ? `"${mostSecondedToast.text}" with **${mostSecondedToast.secondings} secondings**` : "No toasts seconded yet..." },
								{ name: "Bounty Stats", value: `Bounties Hunted: ${othersFinished} bount${othersFinished === 1 ? 'y' : 'ies'}\nBounty Postings: ${mineFinished} bount${mineFinished === 1 ? 'y' : 'ies'}`, inline: true },
								{ name: "Toast Stats", value: `Toasts Raised: ${toastsRaised} toast${toastsRaised === 1 ? "" : "s"}\nToasts Seconded: ${toastsSeconded} toast${toastsSeconded === 1 ? "" : "s"}\nToasts Recieved: ${toastsReceived} toast${toastsReceived === 1 ? "" : "s"}`, inline: true },
								{ name: "Upcoming Level-Up Rewards", value: upcomingRewards.join("\n") }
							)
							.setFooter(randomFooterTip())
							.setTimestamp()
					],
					ephemeral: true
				});
			} catch (message) {
				let selfMessage = message.replace();
				interaction.reply({ content: selfMessage , ephemeral: true });
				return;

			}
		}
	}
);
