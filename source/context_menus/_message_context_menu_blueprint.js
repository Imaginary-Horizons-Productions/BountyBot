const { PermissionFlagBits, InteractionContextType } = require('discord.js');
const { MessageContextMenuWrapper } = require('../classes');

const mainId = "";
module.exports = new MessageContextMenuWrapper(mainId, null, false, [ InteractionContextType.Guild ], 3000,
	/** Specs */
	(interaction, args, database, runMode) => {}
);
