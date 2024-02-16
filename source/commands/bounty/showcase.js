const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getNumberEmoji, trimForSelectOptionDescription, timeConversion } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	database.models.Hunter.findOne({ where: { userId: posterId, companyId: interaction.guildId } }).then(async hunter => {
		const nextShowcaseInMS = new Date(hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
		if (Date.now() < nextShowcaseInMS) {
			interaction.reply({ content: `You can showcase another bounty in <t:${Math.floor(nextShowcaseInMS / 1000)}:R>.`, ephemeral: true });
			return;
		}

		const existingBounties = await database.models.Bounty.findAll({ where: { userId: posterId, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] });
		if (existingBounties.length < 1) {
			interaction.reply({ content: "You doesn't have any open bounties posted.", ephemeral: true });
			return;
		}

		interaction.deferReply({ ephemeral: true }).then(() => {
			return interaction.editReply({
				content: "You can showcase 1 bounty per week. The showcased bounty's XP reward will be increased.",
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
							.setPlaceholder("Select a bounty to showcase...")
							.setMaxValues(1)
							.setOptions(existingBounties.map(bounty => ({
								emoji: getNumberEmoji(bounty.slotNumber),
								label: bounty.title,
								description: trimForSelectOptionDescription(bounty.description),
								value: bounty.id
							})))
					)
				]
			})
		}).then(reply => {
			const collector = reply.createMessageComponentCollector({ max: 1 });
			collector.on("collect", (collectedInteraction) => {
				const [bountyId] = collectedInteraction.values;
				database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
					if (bounty?.state !== "open") {
						collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", ephemeral: true });
						return;
					}

					bounty.increment("showcaseCount");
					await bounty.save().then(bounty => bounty.reload());
					bounty.updatePosting(interaction.guild, bounty.Company, database);
					const hunter = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
					hunter.lastShowcaseTimestamp = new Date();
					hunter.save();
					bounty.asEmbed(interaction.guild, hunter.level, bounty.Company.festivalMultiplierString(), false, database).then(embed => {
						interaction.channel.send({ content: `${interaction.member} increased the reward on their bounty!`, embeds: [embed] });
					})
				})
			})

			collector.on("end", () => {
				interaction.deleteReply();
			})
		})
	})
};

module.exports = {
	data: {
		name: "showcase",
		description: "Show the embed for one of your existing bounties and increase the reward"
	},
	executeSubcommand
};
