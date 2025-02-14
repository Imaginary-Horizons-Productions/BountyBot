'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		queryInterface.sequelize.query(`ALTER TABLE Company DROP COLUMN serverBonusesThumbnailURL`);
		queryInterface.addColumn("Hunter", "itemFindBoost", { type: DataTypes.BOOLEAN, defaultValue: false });
		queryInterface.addColumn("Hunter", "goalsInitiated", { type: DataTypes.BIGINT, defaultValue: 0 });
		queryInterface.addColumn("Hunter", "goalContributions", { type: DataTypes.BIGINT, defaultValue: 0 });
		queryInterface.addColumn("Participation", "goalContributions", { type: DataTypes.INTEGER, defaultValue: 0 });
		queryInterface.createTable("Goal", {
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
			requiredContributions: {
				type: DataTypes.BIGINT,
				allowNull: false
			}
		}, {
			sequelize: queryInterface.sequelize,
			modelName: "Goal",
			freezeTableName: true
		});
		queryInterface.createTable("Contribution", {
			id: {
				primaryKey: true,
				type: DataTypes.UUID,
				defaultValue: DataTypes.UUIDV4
			},
			goalId: {
				type: DataTypes.UUID,
				allowNull: false
			},
			userId: {
				type: DataTypes.STRING,
				allowNull: false
			},
			value: {
				type: DataTypes.BIGINT,
				allowNull: false
			}
		}, {
			sequelize: queryInterface.sequelize,
			modelName: "Contribution",
			freezeTableName: true
		});
	},
	async down(queryInterface, Sequelize) {
		queryInterface.addColumn("Company", "serverBonusesThumbnailURL", { type: DataTypes.STRING });
		queryInterface.sequelize.query(`ALTER TABLE Hunter DROP COLUMN itemFindBoost`);
		queryInterface.sequelize.query(`ALTER TABLE Hunter DROP COLUMN goalsInitiated`);
		queryInterface.sequelize.query(`ALTER TABLE Hunter DROP COLUMN goalContributions`);
		queryInterface.sequelize.query(`ALTER TABLE Participation DROP COLUMN goalContributions`);
		queryInterface.dropTable("Goal");
		queryInterface.dropTable("Contribution");
	}
};
