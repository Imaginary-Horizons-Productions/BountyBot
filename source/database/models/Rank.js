const { Collection, Role, roleMention } = require('discord.js');
const { Model, Sequelize, DataTypes } = require('sequelize');

/** A company's Ranks include a variance threshold (difficulty to achieve) and optionally a role to give hunters and emoji for the scoreboard */
class Rank extends Model {
	static associate(models) { }

	/**
	 * @param {Collection<import('discord.js').Snowflake, Role>} guildRoles
	 * @param {number} index
	 */
	getName(guildRoles, index) {
		if (this.roleId) {
			return guildRoles.get(this.roleId).name;
		} else {
			return `Rank ${index + 1}`;
		}
	}

	/** @param {number} index */
	getMention(index) {
		if (this.roleId) {
			return roleMention(this.roleId);
		} else {
			return `Rank ${index + 1}`;
		}
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	return Rank.init({
		companyId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		threshold: {
			primaryKey: true,
			type: DataTypes.REAL
		},
		roleId: {
			type: DataTypes.STRING
		},
		rankmoji: {
			type: DataTypes.STRING
		}
	}, {
		sequelize,
		modelName: "Rank",
		freezeTableName: true
	});
};

module.exports = { Rank, initModel };
