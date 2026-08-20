import { ActionRowBuilder, bold, ButtonBuilder, ButtonStyle, Colors, ComponentType, EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandStringOption, TimestampStyles } from 'discord.js';
import type { LogicLayer } from '../../logic/index.js';
import { discordTimestamp, timeConversion } from '../../shared';
import { SKIP_INTERACTION_HANDLING } from '../../shared/constants';
import { CommandFunctionality } from '../classes/index.js';
import { getItemCooldown, getItemDescription, getItemNames, useItem } from '../items/_itemDictionary.js';
import { butIgnoreInteractionCollectorErrors, ihpAuthorPayload, randomFooterTip } from '../shared';

let logicLayer: LogicLayer;

const itemNameOption = new SlashCommandStringOption().setName("item-name")
	.setDescription("The item to look up details on")
	.setAutocomplete(true)
	.setChoices(
		getItemNames([]).map(name => ({ name, value: name }))
	).setRequired(true);

const mainId = "item";
export default new CommandFunctionality(mainId, "Get details on a selected item and a button to use it", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	async (interaction, theater, isDevMode) => {
		const itemName = interaction.options.getString(itemNameOption.name, true);
		const itemCount = await logicLayer.items.countUserCopies(interaction.user.id, itemName);
		const hasItem = itemCount > 0 || isDevMode;
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
					.addFields({ name: "You have", value: isDevMode ? "Debug Mode" : itemCount })
					.setFooter(randomFooterTip())
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
						.setStyle(ButtonStyle.Primary)
						.setLabel(`Use a ${itemName}`)
						.setDisabled(!hasItem)
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.Button })).then(async collectedInteration => {
			if (!isDevMode && Date.now() < collectedInteration.member.joinedTimestamp + timeConversion(1, "d", "ms")) {
				collectedInteration.reply({ content: `Items cannot be used in servers that have been joined less than 24 hours ago.`, flags: MessageFlags.Ephemeral });
				return;
			}

			if (!isDevMode && await logicLayer.items.countUserCopies(interaction.user.id, itemName) < 1) {
				collectedInteration.reply({ content: `You don't have any ${itemName}.`, flags: MessageFlags.Ephemeral });
				return;
			}

			const now = new Date();

			const cooldownName = `item-${itemName}`;
			const { isOnCD, endOfCD } = await logicLayer.cooldowns.checkSpecificCooldownForUser(collectedInteration.user.id, cooldownName, now);
			if (isOnCD) {
				collectedInteration.reply({ content: `Please wait, you can use another ${bold(itemName)} again ${discordTimestamp(Math.floor(endOfCD.getTime() / 1000), TimestampStyles.RelativeTime)}.`, flags: MessageFlags.Ephemeral });
				return;
			}
			await logicLayer.cooldowns.updateCooldowns(collectedInteration.user.id, cooldownName, now, getItemCooldown(itemName));

			useItem(itemName, collectedInteration, theater).then(usedCount => {
				if (usedCount > 0 && !isDevMode) {
					logicLayer.items.consume(interaction.user.id, itemName, usedCount);
				}
			});
		}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		});
	}
).setOptions(
	itemNameOption
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
