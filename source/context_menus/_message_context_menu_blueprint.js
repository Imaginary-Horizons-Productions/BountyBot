const { EmbedBuilder, Colors } = require('discord.js');
const { MessageContextMenuWrapper } = require('../classes');
const { Hunter } = require('../models/users/Hunter');
const { buildCompanyStatsEmbed, randomFooterTip, ihpAuthorPayload } = require('../util/embedUtil');
const { generateTextBar } = require('../util/textUtil');
const { Op } = require('sequelize');

const mainId = "";
module.exports = new MessageContextMenuWrapper(mainId, "", null, false, false, 3000,
	/** Specs */
	(interaction, args, database, runMode) => {}
);
