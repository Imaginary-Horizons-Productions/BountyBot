const { StringSelectMenuBuilder, MessageFlags, PermissionFlagsBits, LabelBuilder } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { timeConversion } = require("../../shared");
const { selectOptionsFromBounties, bountyEmbed, unarchiveAndUnlockThread, getBountyBoardThread, isInteractionCollectorError } = require("../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { ModalBuilder } = require("discord.js");

/** @type {typeof import("../../logic")} */
let logicLayer;

const itemName = "Bonus Bounty Showcase";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "Showcase one of your bounties and increase its reward on a separate cooldown", timeConversion(1, "d", "ms"),
		async (interaction, origin) => {
			const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
			if (openBounties.length < 1) {
				interaction.reply({ content: "You don't have any open bounties on this server to showcase.", flags: MessageFlags.Ephemeral });
				return 0;
			}

			const labelIdBountyId = "bounty-id";
			const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
				.setTitle("Showcase Your Bounty")
				.addLabelComponents(
					new LabelBuilder().setLabel("Bounty")
						.setDescription("Up a bounty's XP Reward and repost it in this channel. (Separate cooldown from `/bounty showcase`.)")
						.setStringSelectMenuComponent(
							new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
								.setPlaceholder("Select a bounty...")
								.setOptions(selectOptionsFromBounties(openBounties))
						)
				);
			interaction.showModal(modal);
			return interaction.awaitModalSubmit({ filter: (incoming) => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
				if (!modalSubmission.channel.members.has(modalSubmission.client.user.id)) {
					modalSubmission.reply({ content: "BountyBot is not in the selected channel.", flags: MessageFlags.Ephemeral });
					return 0;
				}

				if (!modalSubmission.channel.permissionsFor(modalSubmission.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
					modalSubmission.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: MessageFlags.Ephemeral });
					return 0;
				}

				const bounty = await logicLayer.bounties.findBounty(modalSubmission.fields.getStringSelectValues(labelIdBountyId)[0]);
				if (!bounty || bounty.state !== "open") {
					modalSubmission.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
					return 0;
				}

				bounty.increment("showcaseCount");
				await bounty.reload();
				const currentPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
				const embed = bountyEmbed(bounty, modalSubmission.member, currentPosterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents));
				const bountyThread = await getBountyBoardThread(modalSubmission.guild, origin.company.bountyBoardId, bounty.postingId);

				modalSubmission.reply({ content: `${modalSubmission.member} increased the reward on their bounty!`, embeds: [embed] });

				if (bountyThread) {
					if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
						(await bountyThread.fetchStarterMessage()).edit({ embeds: [embed] });
						await unarchiveAndUnlockThread(bountyThread, "Bonus Bounty Showcase item used");
					}
					if (bountyThread.sendable) {
						bountyThread.send({ content: `${modalSubmission.member} increased the reward on this bounty!`, flags: MessageFlags.SuppressNotifications });
					}
				}
				return 1;
			}).catch(error => {
				if (!isInteractionCollectorError(error)) {
					console.error(error);
				}
				return 0;
			})
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
