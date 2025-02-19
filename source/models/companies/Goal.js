const { EmbedBuilder, userMention } = require('discord.js');
const { Model, Sequelize, DataTypes } = require('sequelize');
const { congratulationBuilder, listifyEN } = require('../../util/textUtil');

/** A Goal for which all bounty hunters in a company contribute to */
class Goal extends Model {
	static associate(models) {
		models.Goal.Contributions = models.Goal.hasMany(models.Contribution, {
			foreignKey: "goalId"
		})
	}

	/** @param {string[]} contributorIds */
	static generateCompletionEmbed(contributorIds) {
		return new EmbedBuilder().setColor("e5b271")
			.setTitle("Server Goal Completed")
			.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
			.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
			.addFields({ name: "Contributors", value: listifyEN(contributorIds.map(id => userMention(id))) })
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	Goal.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		state: { // "ongoing", "expired", "completed"
			type: DataTypes.STRING,
			defaultValue: "ongoing"
		},
		type: { // "bounties", "toasts", "secondings"
			type: DataTypes.STRING,
			allowNull: false
		},
		requiredGP: {
			type: DataTypes.BIGINT,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Goal",
		freezeTableName: true
	});
	return Goal;
}

module.exports = { Goal, initModel };
