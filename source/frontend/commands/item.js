const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors, InteractionContextType, MessageFlags, ComponentType, DiscordjsErrorCodes } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { getItemNames, getItemDescription, useItem, getItemCooldown } = require('../items/_itemDictionary.js');
const { SKIP_INTERACTION_HANDLING } = require('../../constants.js');
const { ihpAuthorPayload, randomFooterTip } = require('../shared');
const { timeConversion } = require('../../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;
const ITEM_COOLDOWNS = new Map();

const mainId = "item";
module.exports = new CommandWrapper(mainId, "Get details on a selected item and a button to use it", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	async (interaction, runMode) => {
		const itemName = interaction.options.getString("item-name");
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
		const itemRow = await logicLayer.items.findUserItemEntry(interaction.user.id, itemName);
		const hasItem = itemRow !== null && itemRow.count > 0 || runMode !== "production";
		let embedColor = Colors.Blurple;
		if (itemName.includes("Profile Colorizer")) {
			const [color] = itemName.split("Profile Colorizer");
			embedColor = Colors[color.replace(/ /g, "")];
		}
		interaction.editReply({
			embeds: [
				new EmbedBuilder().setColor(embedColor)
					.setAuthor(ihpAuthorPayload)
					.setTitle(itemName)
					.setDescription(getItemDescription(itemName))
					.addFields({ name: "You have", value: runMode !== "production" ? "Debug Mode" : hasItem ? itemRow.count.toString() : "0" })
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
		}).then(message => message.awaitMessageComponent({ time: 120000, componentType: ComponentType.Button })).then(async collectedInteration => {
			if (runMode === "production" && Date.now() < collectedInteration.member.joinedTimestamp + timeConversion(1, "d", "ms")) {
				collectedInteration.reply({ content: `Items cannot be used in servers that have been joined less than 24 hours ago.`, flags: [MessageFlags.Ephemeral] });
				return;
			}

			await itemRow?.reload();
			if (runMode === "production" && itemRow?.count < 1) {
				collectedInteration.reply({ content: `You don't have any ${itemName}.`, flags: [MessageFlags.Ephemeral] });
				return;
			}

			const now = new Date();

			const cooldownName = `item-${itemName}`;
			const {isOnCommandCooldown, cooldownTimestamp} = logicLayer.cooldowns.checkCommandCooldownState(collectedInteration.user.id, cooldownName, now);
			if (isOnCommandCooldown) {
				collectedInteration.reply({ content: `Please wait, you can use another **${itemName}** again <t:${Math.floor(cooldownTimestamp.getTime() / 1000)}:R>.`, flags: [MessageFlags.Ephemeral] });
				return;
			}
			logicLayer.cooldowns.updateCooldowns(collectedInteration.user.id, cooldownName, now, getItemCooldown(itemName));

			return useItem(itemName, collectedInteration).then(shouldSkipDecrement => {
				if (!shouldSkipDecrement && runMode === "production") {
					itemRow?.decrement("count");
				}
			});
		}).catch(error => {
			if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
				console.error(error);
			}
		}).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
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
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
