const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { getItemNames, getItemDescription, useItem } = require('../items/_itemDictionary.js');
const { SKIP_INTERACTION_HANDLING } = require('../constants.js');

const mainId = "item";
module.exports = new CommandWrapper(mainId, "Get details on a selected item and a button to use it", PermissionFlagsBits.SendMessages, false, true, 3000,
	(interaction, database, runMode) => {
		const itemName = interaction.options.getString("item-name");
		interaction.deferReply({ ephemeral: true }).then(async () => {
			const itemRow = await database.models.Item.findOne({ where: { userId: interaction.user.id, itemName } });
			const hasItem = itemRow !== null && itemRow.count > 0;
			return interaction.editReply({
				content: `**${itemName}**\nEffect: ${getItemDescription(itemName)}\n\nYou have: ${hasItem ? itemRow.count : "0"}`,
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
				database.models.Item.findOne({ where: { userId: collectedInteration.user.id, itemName } }).then(itemRow => {
					if (itemRow.count < 1) {
						collectedInteration.reply({ content: `You don't have any ${itemName}.`, ephemeral: true });
						return;
					}
					useItem(itemName, collectedInteration, database);
					itemRow.decrement("count");
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
