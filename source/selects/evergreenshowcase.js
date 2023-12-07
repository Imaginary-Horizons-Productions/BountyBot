const { SelectWrapper } = require('../classes');

const mainId = "evergreenshowcase";
module.exports = new SelectWrapper(mainId, 3000,
	/** Show the evergreen bounty's embed again */
	(interaction, args, database) => {
		const [bountyId] = interaction.values;
		database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
			if (bounty?.state !== "open") {
				interaction.reply({ content: "The selected bounty seems to have been deleted.", ephemeral: true });
				return;
			}

			bounty.asEmbed(interaction.guild, bounty.Company.level, bounty.Company.festivalMultiplierString(), false, database).then(embed => {
				interaction.reply({ embeds: [embed] });
			});
		});
	}
);
