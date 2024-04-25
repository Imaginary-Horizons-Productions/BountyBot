const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { useItem } = require('../items/_itemDictionary.js');
const { Op } = require('sequelize');

const mainId = "use-item";
module.exports = new CommandWrapper(mainId, "description", PermissionFlagsBits.SendMessages, false, true, 3000,
	/** Call item function from dictionary, then decrement count in inventory */
	(interaction, database, runMode) => {
		const itemName = interaction.options.getString("item-name");
		database.models.Item.findOne({ where: { userId: interaction.user.id, itemName } }).then(itemRow => {
			if (itemRow.count < 1) {
				interaction.reply({ content: `You don't have any ${itemName}.`, ephemeral: true });
				return;
			}
			useItem(itemName, interaction, database);
			itemRow.decrement();
		})
	}
).setOptions(
	{
		type: "String",
		name: "item-name",
		description: "Results will be filtered by your inventory",
		required: true,
		autocompleteFilter: async (interaction, database) => {
			return (await database.models.Item.findAll({ where: { userId: interaction.user.id, count: { [Op.gt]: 0 } } })).map(item => ({ name: item.itemName, value: item.itemName }));
		}
	}
);
