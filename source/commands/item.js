const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { getItemNames, getItemDescription, useItem, getItemCooldown } = require('../items/_itemDictionary.js');
const { SKIP_INTERACTION_HANDLING } = require('../constants.js');
const { ihpAuthorPayload, randomFooterTip } = require('../util/embedUtil.js');
const { timeConversion } = require('../util/textUtil.js');

const ITEM_COOLDOWNS = new Map();

const mainId = "item";
module.exports = new CommandWrapper(mainId, "Get details on a selected item and a button to use it", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	(interaction, database, runMode) => {
		const itemName = interaction.options.getString("item-name");
		interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).then(async () => {
			const itemRow = await database.models.Item.findOne({ where: { userId: interaction.user.id, itemName } });
			const hasItem = itemRow !== null && itemRow.count > 0 || runMode !== "prod";
			let embedColor = Colors.Blurple;
			if (itemName.includes("Profile Colorizer")) {
				const [color] = itemName.split("Profile Colorizer");
				embedColor = Colors[color.replace(/ /g, "")];
			}
			return interaction.editReply({
				embeds: [
					new EmbedBuilder().setColor(embedColor)
						.setAuthor(ihpAuthorPayload)
						.setTitle(itemName)
						.setDescription(getItemDescription(itemName))
						.addFields({ name: "You have", value: runMode !== "prod" ? "Debug Mode" : hasItem ? itemRow.count.toString() : "0" })
						.setFooter(randomFooterTip())
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}`)
							.setStyle(ButtonStyle.Primary)
							.setLabel(`Use a ${itemName}`)
							.setDisabled(!hasItem)
					)
				]
			});
		}).then(reply => {
			const collector = reply.createMessageComponentCollector({ max: 1 });
			collector.on("collect", (collectedInteration) => {
				if (Date.now() > collectedInteration.member.joinedTimestamp + timeConversion(1, "d", "ms")) {
					collectedInteration.reply({ content: `Items cannot be used in servers that have been joined less than 24 hours ago.`, flags: [MessageFlags.Ephemeral] });
					return;
				}

				database.models.Item.findOne({ where: { userId: collectedInteration.user.id, itemName } }).then(itemRow => {
					if (runMode === "prod" && itemRow.count < 1) {
						collectedInteration.reply({ content: `You don't have any ${itemName}.`, flags: [MessageFlags.Ephemeral] });
						return;
					}

					const now = Date.now();

					if (!ITEM_COOLDOWNS.has(itemName)) {
						ITEM_COOLDOWNS.set(itemName, new Map());
					}

					const timestamps = ITEM_COOLDOWNS.get(itemName);
					if (timestamps.has(collectedInteration.user.id)) {
						const expirationTime = timestamps.get(collectedInteration.user.id) + getItemCooldown(itemName);

						if (now < expirationTime) {
							collectedInteration.reply({ content: `Please wait, you can use another **${itemName}** again <t:${Math.round(expirationTime / 1000)}:R>.`, flags: [MessageFlags.Ephemeral] });
							return;
						} else {
							timestamps.delete(collectedInteration.user.id);
						}
					} else {
						timestamps.set(collectedInteration.user.id, now);
						setTimeout(() => timestamps.delete(collectedInteration.user.id), getItemCooldown(itemName));
					}

					useItem(itemName, collectedInteration, database).then(shouldSkipDecrement => {
						if (!shouldSkipDecrement && runMode === "prod") {
							itemRow.decrement("count");
						}
					});
				})
			})

			collector.on("end", () => {
				interaction.deleteReply();
			})
		});
	}
).setOptions(
	{
		type: "String",
		name: "item-name",
		description: "The item to look up details on",
		required: true,
		autocomplete: getItemNames([]).map(name => ({ name, value: name }))
	}
);
