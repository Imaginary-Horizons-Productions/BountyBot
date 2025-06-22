'use strict';
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		queryInterface.createTable("UserInteraction", {
			userId: {
				primaryKey: true,
				type: DataTypes.STRING,
				allowNull: false
			},
			interactionName: {
				primaryKey: true,
				type: DataTypes.STRING,
				allowNull: false
			},
			interactionTime: {
				type: DataTypes.DATE
			},
			lastInteractTime: {
				type: DataTypes.DATE
			},
			cooldownTime: {
				type: DataTypes.DATE
			},
			hitTimes: {
				type: DataTypes.NUMBER,
				defaultValue: 0
			}
		}, {
			sequelize: queryInterface.sequelize,
			modelName: "UserInteraction",
			freezeTableName: true,
			timestamps: false
		});
	},
	async down(queryInterface, Sequelize) {
		queryInterface.dropTable('UserInteraction');
	}
};