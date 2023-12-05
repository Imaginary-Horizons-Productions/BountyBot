const { SelectWrapper } = require('../classes');

const mainId = "evergreenshowcase";
module.exports = new SelectWrapper(mainId, 3000,
	/** Show the evergreen bounty's embed again */
	(interaction, args, database) => {
		const [slotNumber] = interaction.values;
		database.models.Bounty.findOne({ where: { isEvergreen: true, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
			const company = await database.models.Company.findByPk(interaction.guildId);
			return bounty.asEmbed(interaction.guild, company.level, company.festivalMultiplierString(), database);
		}).then(embed => {
			interaction.reply({ embeds: [embed] });
		});
	}
);
