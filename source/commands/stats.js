const { EmbedBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { buildGuildStatsEmbed, randomFooterTip, ihpAuthorPayload } = require('../embedHelpers');
const { database } = require('../../database');
const { generateTextBar } = require('../helpers');
const { Hunter } = require('../models/users/Hunter');

const customId = "stats";
const options = [
	{
		type: "User",
		name: "bounty-hunter",
		description: "Whose stats to check; BountyBot for the server stats, empty for yourself",
		required: false,
		choices: []
	}
];
const subcommands = [];
module.exports = new CommandWrapper(customId, "Get the BountyBot stats for yourself or someone else", null, false, false, 3000, options, subcommands,
	/** Get the BountyBot stats for yourself or someone else */
	(interaction) => {
		const target = interaction.options.getMember("user"); //TODO switch from magic string "user" to options[0].name
		if (target && target.id !== interaction.user.id) {
			if (target.id == interaction.client.user.id) {
				// BountyBot
				buildGuildStatsEmbed(interaction.guild).then(embed => {
					interaction.reply({
						embeds: [embed],
						ephemeral: true
					});
				})
			} else {
				// Other Hunter
				database.models.Hunter.findOne({ where: { userId: target.id, guildId: interaction.guildId } }).then(async hunter => {
					if (!hunter) {
						interaction.reply({ content: "The specified user doesn't seem to have a profile with this server's BountyBot yet. It'll be created when they gain XP.", ephemeral: true });
						return;
					}

					const { xpCoefficient } = await database.models.Guild.findByPk(interaction.guildId);
					const currentLevelThreshold = Hunter.xpThreshold(hunter.level, xpCoefficient);
					const nextLevelThreshold = Hunter.xpThreshold(hunter.level + 1, xpCoefficient);

					interaction.reply({
						embeds: [
							new EmbedBuilder().setColor(target.displayColor)
								.setAuthor(ihpAuthorPayload)
								.setThumbnail(target.user.avatarURL())
								.setTitle(`${target.displayName} is __Level ${hunter.level}__`)
								.setDescription(`${generateTextBar(hunter.xp - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}\nThey have earned *${hunter.seasonXP} XP* this season.`)
								.addFields(
									//TODO previous season placements
									{ name: "Season Placements", value: `Currently: ${hunter.seasonPlacement == 0 ? "Unranked" : "#" + hunter.seasonPlacement}` },
									{ name: "Bounties Hunted", value: `${hunter.othersFinished} bount${hunter.othersFinished == 1 ? 'y' : 'ies'}`, inline: true },
									{ name: "Bounty Postings", value: `${hunter.mineFinished} bount${hunter.mineFinished == 1 ? 'y' : 'ies'}`, inline: true },
									{ name: "Total XP Earned", value: `${hunter.xp} XP`, inline: true },
									{ name: "\u200B", value: "\u200B" },
									{ name: "Toasts Raised", value: `${hunter.toastsRaised} toast${hunter.toastsRaised == 1 ? "" : "s"}`, inline: true },
									{ name: "Toasts Recieved", value: `${hunter.toastsReceived} toast${hunter.toastsReceived == 1 ? "" : "s"}`, inline: true },
									{ name: "\u200B", value: "\u200B", inline: true }
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
			database.models.Hunter.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId } }).then(async hunter => {
				if (!hunter) {
					interaction.reply("You don't seem to have a profile with this server's BountyBot yet. It'll be created when you gain XP.");
					return;
				}

				const { xpCoefficient, maxSimBounties } = await database.models.Guild.findByPk(interaction.guildId);
				const currentLevelThreshold = Hunter.xpThreshold(hunter.level, xpCoefficient);
				const nextLevelThreshold = Hunter.xpThreshold(hunter.level + 1, xpCoefficient);
				const bountySlots = hunter.maxSlots(maxSimBounties);

				interaction.reply({
					embeds: [
						new EmbedBuilder().setColor(interaction.member.displayColor)
							.setAuthor(ihpAuthorPayload)
							.setThumbnail(interaction.user.avatarURL())
							.setTitle(`You are __Level ${hunter.level}__ in ${interaction.guild.name}`)
							.setDescription(
								`${generateTextBar(hunter.xp - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)} *Next Level:* ${nextLevelThreshold - hunter.xp} XP\n\
								You have earned *${hunter.seasonXP} XP* this season${false /* TODO rankString */ ? ` which qualifies for the rank @${"" /* TODO rankString */}` : ""}.\n\n\
								You have ${bountySlots} bounty slot${bountySlots == 1 ? '' : 's'}!`
							)
							.addFields(
								//TODO previous season placements
								{ name: "Season Placements", value: `Currently: ${hunter.seasonPlacement == 0 ? "Unranked" : "#" + hunter.seasonPlacement}` },
								{ name: `Level ${hunter.level + 1} Reward`, value: hunter.levelUpReward(hunter.level + 1, maxSimBounties, true), inline: true },
								{ name: `Level ${hunter.level + 2} Reward`, value: hunter.levelUpReward(hunter.level + 2, maxSimBounties, true), inline: true },
								{ name: `Level ${hunter.level + 3} Reward`, value: hunter.levelUpReward(hunter.level + 3, maxSimBounties, true), inline: true },
								{ name: "\u200B", value: "\u200B" },
								{ name: "Bounties Hunted", value: `${hunter.othersFinished} bount${hunter.othersFinished == 1 ? 'y' : 'ies'}`, inline: true },
								{ name: "Bounty Postings", value: `${hunter.mineFinished} bount${hunter.mineFinished == 1 ? 'y' : 'ies'}`, inline: true },
								{ name: "Total XP Earned", value: `${hunter.xp} XP`, inline: true },
								{ name: "\u200B", value: "\u200B" },
								{ name: "Toasts Raised", value: `${hunter.toastsRaised} toast${hunter.toastsRaised == 1 ? "" : "s"}`, inline: true },
								{ name: "Toasts Recieved", value: `${hunter.toastsReceived} toast${hunter.toastsReceived == 1 ? "" : "s"}`, inline: true },
								{ name: "\u200B", value: "\u200B", inline: true }
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
