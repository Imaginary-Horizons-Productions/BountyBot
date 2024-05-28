const { PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes/index.js');
const { Op } = require('sequelize');
const { commandMention } = require('../util/textUtil.js');
const { MAX_MESSAGE_CONTENT_LENGTH } = require('../constants.js');

const mainId = "inventory";
module.exports = new CommandWrapper(mainId, "Show the user the items in their inventory", PermissionFlagsBits.ViewChannel, false, true, 3000,
	(interaction, database, runMode) => {
		database.models.Item.findAll({ where: { userId: interaction.user.id, count: { [Op.gt]: 0 } } }).then(itemRows => {
			let content = `Here are the items in your inventory (use them with ${commandMention("item")}):\n- `;
			if (itemRows.length > 0) {
				content += `${itemRows.map(row => `${row.itemName} x ${row.count}`).join("\n- ")}`;
			} else {
				content += "(None yet, do some bounties to find some!)";
			}
			if (content.length < MAX_MESSAGE_CONTENT_LENGTH) {
				interaction.reply({ content, ephemeral: true });
			} else {
				interaction.reply({
					files: [new AttachmentBuilder(Buffer.from(content), { name: "inventory.txt" })],
					ephemeral: true
				});
			}
		});
	}
);
