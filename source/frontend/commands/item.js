const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors, InteractionContextType, MessageFlags, ComponentType, DiscordjsErrorCodes, bold, TimestampStyles } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { getItemNames, getItemDescription, useItem, getItemCooldown } = require('../items/_itemDictionary.js');
const { SKIP_INTERACTION_HANDLING } = require('../../constants.js');
const { ihpAuthorPayload, randomFooterTip } = require('../shared');
const { timeConversion, discordTimestamp } = require('../../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "item";
module.exports = new CommandWrapper(mainId, "Get details on a selected item and a button to use it", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	async (interaction, origin, runMode) => {
		const itemName = interaction.options.getString("item-name");
		const itemCount = await logicLayer.items.countUserCopies(interaction.user.id, itemName);
		const hasItem = itemCount > 0 || runMode !== "production";
		let embedColor = Colors.Blurple;
		if (itemName.includes("Profile Colorizer")) {
			const [color] = itemName.split("Profile Colorizer");
			embedColor = Colors[color.replace(/ /g, "")];
		}
		interaction.reply({
			embeds: [
				new EmbedBuilder().setColor(embedColor)
					.setAuthor(ihpAuthorPayload)
					.setTitle(itemName)
					.setDescription(getItemDescription(itemName))
					.addFields({ name: "You have", value: runMode !== "production" ? "Debug Mode" : itemCount })
					.setFooter(randomFooterTip())
			],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}`)
						.setStyle(ButtonStyle.Primary)
						.setLabel(`Use a ${itemName}`)
						.setDisabled(!hasItem)
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.Button })).then(async collectedInteration => {
			if (runMode === "production" && Date.now() < collectedInteration.member.joinedTimestamp + timeConversion(1, "d", "ms")) {
				collectedInteration.reply({ content: `Items cannot be used in servers that have been joined less than 24 hours ago.`, flags: MessageFlags.Ephemeral });
				return;
			}

			if (runMode === "production" && await logicLayer.items.countUserCopies(interaction.user.id, itemName) < 1) {
				collectedInteration.reply({ content: `You don't have any ${itemName}.`, flags: MessageFlags.Ephemeral });
				return;
			}

			const now = new Date();

			const cooldownName = `item-${itemName}`;
			const { isOnCommandCooldown, cooldownTimestamp } = await logicLayer.cooldowns.checkCommandCooldownState(collectedInteration.user.id, cooldownName, now);
			if (isOnCommandCooldown) {
				collectedInteration.reply({ content: `Please wait, you can use another ${bold(itemName)} again ${discordTimestamp(Math.floor(cooldownTimestamp.getTime() / 1000), TimestampStyles.RelativeTime)}.`, flags: MessageFlags.Ephemeral });
				return;
			}
			await logicLayer.cooldowns.updateCooldowns(collectedInteration.user.id, cooldownName, now, getItemCooldown(itemName));

			return useItem(itemName, collectedInteration, origin).then(shouldSkipDecrement => {
				if (!shouldSkipDecrement && runMode === "production") {
					return logicLayer.items.consume(interaction.user.id, itemName);
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
